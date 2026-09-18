import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const COINCAP_BASE_URL = "https://api.coincap.io/v2";

interface Coin {
  id: string;
  symbol: string;
  name: string;
  coincap_id: string;
}

interface CoinCapHistoryPoint {
  time: number;
  priceUsd: string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAllCoins(): Promise<Coin[]> {
  const { data, error } = await supabase
    .from("coins")
    .select("id, symbol, name, coincap_id");

  if (error) {
    throw new Error(`Failed to fetch coins: ${error.message}`);
  }

  return data as Coin[];
}

async function fetchCoinHistory(
  coinId: string,
  interval: string = "d1",
  limit: number = 2
): Promise<CoinCapHistoryPoint[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = yesterday.getTime();
  const end = new Date().getTime();

  const params = new URLSearchParams({
    interval,
    limit: limit.toString(),
    start: start.toString(),
    end: end.toString(),
  });

  const response = await fetch(
    `${COINCAP_BASE_URL}/assets/${coinId}/history?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `CoinCap API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.data as CoinCapHistoryPoint[];
}

async function fetchCurrentAssets(coinIds: string[]): Promise<Record<string, unknown>> {
  if (coinIds.length === 0) return {};

  const params = new URLSearchParams({
    ids: coinIds.join(","),
    limit: "50",
  });

  const response = await fetch(`${COINCAP_BASE_URL}/assets?${params}`);

  if (!response.ok) {
    throw new Error(
      `CoinCap API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const assets: Record<string, unknown> = {};
  for (const asset of data.data) {
    assets[asset.id] = asset;
  }
  return assets;
}

async function syncDaily() {
  console.log("[sync-daily] Starting daily sync");

  const coins = await getAllCoins();
  if (coins.length === 0) {
    console.log("[sync-daily] No coins to sync");
    return { success: true, coinsProcessed: 0 };
  }

  console.log(`[sync-daily] Processing ${coins.length} coins`);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let processed = 0;
  let failed = 0;

  // Fetch current market data for all coins
  try {
    const coincapIds = coins.map((c) => c.coincap_id);
    const currentAssets = await fetchCurrentAssets(coincapIds);

    for (const coin of coins) {
      try {
        const asset = currentAssets[coin.coincap_id];
        if (asset && typeof asset === "object") {
          const assetData = asset as Record<string, unknown>;
          const { error } = await supabase
            .from("coin_metrics")
            .update({
              market_cap: assetData.marketCapUsd
                ? parseFloat(assetData.marketCapUsd as string)
                : null,
              volume24h: assetData.volumeUsd24Hr
                ? parseFloat(assetData.volumeUsd24Hr as string)
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("coin_id", coin.id);

          if (error) {
            console.warn(
              `[sync-daily] Failed to update metrics for ${coin.symbol}: ${error.message}`
            );
          }
        }
      } catch (error) {
        console.warn(
          `[sync-daily] Error updating metrics for ${coin.symbol}:`,
          error
        );
      }
    }
  } catch (error) {
    console.warn("[sync-daily] Failed to fetch/update current market data:", error);
  }

  // Fetch and insert daily candles
  for (const coin of coins) {
    try {
      // Check if we already have yesterday's data
      const { data: existingData } = await supabase
        .from("price_daily")
        .select("id")
        .eq("coin_id", coin.id)
        .eq("date", yesterdayStr)
        .single();

      if (existingData) {
        console.log(
          `[sync-daily] ${coin.symbol}: Data for ${yesterdayStr} already exists`
        );
        continue;
      }

      // Fetch yesterday's data
      const history = await fetchCoinHistory(coin.coincap_id, "d1", 2);

      if (!history || history.length === 0) {
        console.log(
          `[sync-daily] ${coin.symbol}: No data available for ${yesterdayStr}`
        );
        continue;
      }

      const mappedHistory = history.map((h) => ({
        date: new Date(h.time).toISOString().split("T")[0],
        price: Number(h.priceUsd),
      }));

      const yesterdayData = mappedHistory.find((h) => h.date === yesterdayStr);

      if (!yesterdayData) {
        console.log(
          `[sync-daily] ${coin.symbol}: No data for ${yesterdayStr}`
        );
        continue;
      }

      const { error } = await supabase.from("price_daily").insert({
        coin_id: coin.id,
        date: yesterdayStr,
        open: yesterdayData.price,
        high: yesterdayData.price,
        low: yesterdayData.price,
        close: yesterdayData.price,
        volume: null,
        market_cap: null,
      });

      if (error) {
        console.error(
          `[sync-daily] ${coin.symbol}: Failed to insert price: ${error.message}`
        );
        failed++;
        continue;
      }

      console.log(
        `[sync-daily] ${coin.symbol}: Inserted candle for ${yesterdayStr}`
      );
      processed++;
    } catch (error) {
      console.error(`[sync-daily] ${coin.symbol}: Sync failed:`, error);
      failed++;
    }
  }

  console.log(
    `[sync-daily] Completed: ${processed} processed, ${failed} failed`
  );
  return { success: true, coinsProcessed: processed, failed };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const result = await syncDaily();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sync-daily] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
