import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

interface Coin {
  id: string;
  symbol: string;
  name: string;
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
    .select("id, symbol, name, coingecko_id");

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

async function fetchMarketChart(
  coingeckoId: string,
  days: number = 2
): Promise<number[][]> {
  const params = new URLSearchParams({
    vs_currency: "usd",
    days: days.toString(),
  });

  const response = await fetch(
    `${COINGECKO_BASE_URL}/coins/${coingeckoId}/market_chart?${params}`
  );

  if (!response.ok) {
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.prices; // Array of [timestamp, price]
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

  // Fetch and update current market data
  try {
    const coingeckoIds = coins.map((c) => c.coingecko_id);
    const pricesData = await fetchCurrentPrices(coingeckoIds);

    for (const coin of coins) {
      try {
        const priceInfo = pricesData[coin.coingecko_id];
        if (!priceInfo) continue;

        const { error } = await supabase
          .from("coin_metrics")
          .update({
            market_cap: priceInfo.usd_market_cap,
            volume24h: priceInfo.usd_24h_vol,
            updated_at: new Date().toISOString(),
          })
          .eq("coin_id", coin.id);

        if (error) {
          console.warn(
            `[sync-daily] Failed to update metrics for ${coin.symbol}: ${error.message}`
          );
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

      // Fetch last 2 days of price data
      const marketChart = await fetchMarketChart(coin.coingecko_id, 2);

      if (!marketChart || marketChart.length === 0) {
        console.log(
          `[sync-daily] ${coin.symbol}: No price data available`
        );
        continue;
      }

      // Find yesterday's price (most recent before today)
      const yesterdayDate = new Date(yesterdayStr);
      const yesterdayTime = yesterdayDate.getTime();
      const todayTime = new Date().getTime();

      const yesterdayPrice = marketChart.find(([timestamp]) => {
        const date = new Date(timestamp).toISOString().split("T")[0];
        return date === yesterdayStr;
      });

      if (!yesterdayPrice) {
        console.log(
          `[sync-daily] ${coin.symbol}: No data for ${yesterdayStr}`
        );
        continue;
      }

      const price = yesterdayPrice[1];

      const { error } = await supabase.from("price_daily").insert({
        coin_id: coin.id,
        date: yesterdayStr,
        open: price,
        high: price,
        low: price,
        close: price,
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
        `[sync-daily] ${coin.symbol}: Inserted candle for ${yesterdayStr} at $${price}`
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
