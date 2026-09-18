import { serve } from "https://deno.land/std@0.175.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const COINCAP_BASE_URL = "https://api.coincap.io/v2";

interface Coin {
  id: string;
  symbol: string;
  coincap_id: string;
}

interface CoinCapAsset {
  id: string;
  priceUsd: string;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  changePercent24Hr: string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAllCoins(): Promise<Coin[]> {
  const { data, error } = await supabase
    .from("coins")
    .select("id, symbol, coincap_id");

  if (error) {
    throw new Error(`Failed to fetch coins: ${error.message}`);
  }

  return data as Coin[];
}

async function fetchCurrentAssets(coinIds: string[]): Promise<CoinCapAsset[]> {
  if (coinIds.length === 0) return [];

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
  return data.data as CoinCapAsset[];
}

async function syncIntraday() {
  console.log("[sync-intraday] Starting intraday sync");

  const coins = await getAllCoins();
  if (coins.length === 0) {
    console.log("[sync-intraday] No coins to sync");
    return { success: true, coinsProcessed: 0 };
  }

  console.log(`[sync-intraday] Processing ${coins.length} coins`);

  const coincapIds = coins.map((c) => c.coincap_id);
  const assets = await fetchCurrentAssets(coincapIds);

  let processed = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const coin = coins.find((c) => c.coincap_id === asset.id);
      if (!coin) continue;

      const price = parseFloat(asset.priceUsd);
      const marketCap = parseFloat(asset.marketCapUsd);
      const volume24h = parseFloat(asset.volumeUsd24Hr);
      const change24h = parseFloat(asset.changePercent24Hr);

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
        // Don't fail the whole sync, just warn
      }

      console.log(`[sync-intraday] ${coin.symbol}: Updated price to $${price}`);
      processed++;
    } catch (error) {
      console.error(
        `[sync-intraday] ${asset.id}: Error processing asset:`,
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
