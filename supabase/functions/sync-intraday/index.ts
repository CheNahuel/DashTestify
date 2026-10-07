import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

interface Coin {
  id: string;
  symbol: string;
  coingecko_id: string;
}

interface CoinGeckoPrice {
  [key: string]: {
    usd: number;
    usd_market_cap: number;
    usd_24h_vol: number;
    usd_24h_change: number;
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// Keep in sync with src/sync/intraday-points.ts. Ten 5-minute points cover 1H.
const MIN_LAST_HOUR_POINTS = 10;
const TAIL_MAX_AGE_MS = 15 * 60 * 1000;

function intradayTailIsFresh(
  lastHourCount: number | null,
  newestTimestamp: string | null,
  now = Date.now(),
): boolean {
  if (lastHourCount == null || lastHourCount < MIN_LAST_HOUR_POINTS) return false;
  if (!newestTimestamp) return false;
  const ageMs = now - new Date(newestTimestamp).getTime();
  return Number.isFinite(ageMs) && ageMs < TAIL_MAX_AGE_MS;
}

async function backfillLastDay(coin: Coin) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const hourStart = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("price_intraday")
    .select("id", { count: "exact", head: true })
    .eq("coin_id", coin.id)
    .gte("timestamp", hourStart);

  if (countError) {
    console.warn(
      `[sync-intraday] ${coin.symbol}: could not count intraday rows: ${countError.message}`,
    );
  }

  let newestTimestamp: string | null = null;
  if (!countError) {
    const { data: latestRows, error: latestError } = await supabase
      .from("price_intraday")
      .select("timestamp")
      .eq("coin_id", coin.id)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (latestError) {
      console.warn(
        `[sync-intraday] ${coin.symbol}: could not read newest intraday point: ${latestError.message}`,
      );
    } else {
      newestTimestamp = latestRows?.[0]?.timestamp ?? null;
    }
  }

  if (!countError && intradayTailIsFresh(count ?? 0, newestTimestamp)) {
    return;
  }

  let response: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${coin.coingecko_id}/market_chart?vs_currency=usd&days=1`,
    );
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 15_000 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    console.warn(
      `[sync-intraday] ${coin.symbol}: intraday backfill failed ${response?.status ?? "no response"}`,
    );
    return;
  }

  const data = await response.json();
  const now = Date.now();
  const start = now - DAY_MS;
  const marketCaps = new Map<number, number>(
    (data.market_caps ?? []).map((row: number[]) => [row[0], row[1]]),
  );
  const volumes = new Map<number, number>(
    (data.total_volumes ?? []).map((row: number[]) => [row[0], row[1]]),
  );

  const { data: existing, error: existingError } = await supabase
    .from("price_intraday")
    .select("timestamp")
    .eq("coin_id", coin.id)
    .gte("timestamp", since)
    .limit(1000);

  if (existingError) {
    console.warn(
      `[sync-intraday] ${coin.symbol}: could not read intraday rows: ${existingError.message}`,
    );
    return;
  }

  const existingTimes = new Set(
    (existing ?? []).map((row: { timestamp: string }) =>
      new Date(row.timestamp).toISOString()
    ),
  );
  const seen = new Set<string>();

  const rows = ((data.prices ?? []) as number[][])
    .filter(([time, price]) => time >= start && time <= now && Number.isFinite(price))
    .map(([time, price]) => ({
      coin_id: coin.id,
      timestamp: new Date(time).toISOString(),
      price,
      market_cap: marketCaps.get(time) ?? null,
      volume_24h: volumes.get(time) ?? null,
      change_24h: null,
    }))
    .filter((row) => {
      if (existingTimes.has(row.timestamp) || seen.has(row.timestamp)) return false;
      seen.add(row.timestamp);
      return true;
    });

  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const { error } = await supabase.from("price_intraday").insert(batch);
    if (error) {
      console.warn(
        `[sync-intraday] ${coin.symbol}: backfill insert failed: ${error.message}`,
      );
      return;
    }
  }

  if (rows.length > 0) {
    console.log(
      `[sync-intraday] ${coin.symbol}: backfilled ${rows.length} intraday points`,
    );
  }
}

async function getAllCoins(): Promise<Coin[]> {
  const { data, error } = await supabase
    .from("coins")
    .select("id, symbol, coingecko_id");

  if (error) {
    throw new Error(`Failed to fetch coins: ${error.message}`);
  }

  return (data as Coin[]).filter((c) => c.coingecko_id);
}

async function fetchCurrentPrices(
  coingeckoIds: string[]
): Promise<CoinGeckoPrice> {
  if (coingeckoIds.length === 0) return {};

  const params = new URLSearchParams({
    ids: coingeckoIds.join(","),
    vs_currencies: "usd",
    include_market_cap: "true",
    include_24hr_vol: "true",
    include_24hr_change: "true",
  });

  const response = await fetch(
    `${COINGECKO_BASE_URL}/simple/price?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function syncIntraday() {
  console.log("[sync-intraday] Starting intraday sync");

  const coins = await getAllCoins();
  if (coins.length === 0) {
    console.log("[sync-intraday] No coins to sync");
    return { success: true, coinsProcessed: 0 };
  }

  console.log(`[sync-intraday] Processing ${coins.length} coins`);

  const coingeckoIds = coins.map((c) => c.coingecko_id);
  const pricesData = await fetchCurrentPrices(coingeckoIds);

  let processed = 0;
  let failed = 0;

  for (const coin of coins) {
    try {
      try {
        await backfillLastDay(coin);
      } catch (error) {
        console.warn(`[sync-intraday] ${coin.symbol}: backfill skipped:`, error);
      }

      const priceInfo = pricesData[coin.coingecko_id];
      if (!priceInfo) {
        console.warn(`[sync-intraday] ${coin.symbol}: No price data`);
        continue;
      }

      const price = priceInfo.usd;
      const marketCap = priceInfo.usd_market_cap;
      const volume24h = priceInfo.usd_24h_vol;
      const change24h = priceInfo.usd_24h_change;

      // Insert price snapshot. This stays the ongoing tail after the one-time backfill.
      const { error: priceError } = await supabase
        .from("price_intraday")
        .insert({
          coin_id: coin.id,
          timestamp: new Date().toISOString(),
          price,
          market_cap: marketCap,
          volume_24h: volume24h,
          change_24h: change24h,
        });

      if (priceError) {
        console.error(
          `[sync-intraday] ${coin.symbol}: Failed to insert price: ${priceError.message}`
        );
        failed++;
        continue;
      }

      // Update coin metrics with latest data
      const { error: metricsError } = await supabase
        .from("coin_metrics")
        .update({
          current_price: price,
          market_cap: marketCap,
          volume24h: volume24h,
          updated_at: new Date().toISOString(),
        })
        .eq("coin_id", coin.id);

      if (metricsError) {
        console.warn(
          `[sync-intraday] ${coin.symbol}: Failed to update metrics: ${metricsError.message}`
        );
      }

      console.log(`[sync-intraday] ${coin.symbol}: Updated price to $${price}`);
      processed++;
    } catch (error) {
      console.error(
        `[sync-intraday] ${coin.symbol}: Error processing:`,
        error
      );
      failed++;
    }
  }

  console.log(
    `[sync-intraday] Completed: ${processed} processed, ${failed} failed`
  );
  return { success: true, coinsProcessed: processed, failed };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await syncIntraday();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sync-intraday] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
