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
      const priceInfo = pricesData[coin.coingecko_id];
      if (!priceInfo) {
        console.warn(`[sync-intraday] ${coin.symbol}: No price data`);
        continue;
      }

      const price = priceInfo.usd;
      const marketCap = priceInfo.usd_market_cap;
      const volume24h = priceInfo.usd_24h_vol;
      const change24h = priceInfo.usd_24h_change;

      // Insert price snapshot
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
