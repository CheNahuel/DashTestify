import { getSupabaseServiceClient } from "@/lib/supabase";
import { coincapClient } from "@/services/coincap/client";
import * as queries from "@/database/queries";

/**
 * Intraday sync: refresh current prices and metrics for all coins.
 * Runs every 5 minutes.
 * Updates price_intraday and coin_metrics tables.
 */
export async function syncIntraday() {
  const supabaseService = getSupabaseServiceClient();

  try {
    console.log("Starting intraday sync...");

    // Get all coins
    const coins = await queries.getAllCoins();

    if (coins.length === 0) {
      console.log("No coins to sync");
      return { success: true, coinsProcessed: 0, pricesUpdated: 0 };
    }

    console.log(`Processing ${coins.length} coins...`);

    const coincapIds = coins.map((c) => c.coincap_id);
    const now = new Date();
    let pricesUpdated = 0;

    try {
      // Fetch current prices for all coins in one batch
      const assets = await coincapClient.fetchAssets(coincapIds);

      // Map assets by coincap_id for quick lookup
      const assetMap = new Map(assets.map((a) => [a.id, a]));

      // Insert/upsert for each coin
      for (const coin of coins) {
        const asset = assetMap.get(coin.coincap_id);

        if (!asset) {
          console.log(`${coin.symbol}: No data from CoinCap, skipping`);
          continue;
        }

        try {
          // Insert into price_intraday
          const { error: intradayError } = await supabaseService
            .from("price_intraday")
            .insert({
              coin_id: coin.id,
              timestamp: now.toISOString(),
              price: parseFloat(asset.priceUsd),
              market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
              volume_24h: asset.volumeUsd24Hr ? parseFloat(asset.volumeUsd24Hr) : null,
              change_24h: asset.changePercent24Hr
                ? parseFloat(asset.changePercent24Hr)
                : null,
            });

          if (intradayError) {
            console.error(`${coin.symbol}: Failed to insert intraday price:`, intradayError);
            continue;
          }

          pricesUpdated++;

          // Update coin_metrics current_price and volume
          const { error: metricsError } = await supabaseService
            .from("coin_metrics")
            .update({
              current_price: parseFloat(asset.priceUsd),
              market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
              volume24h: asset.volumeUsd24Hr ? parseFloat(asset.volumeUsd24Hr) : null,
              updated_at: now.toISOString(),
            })
            .eq("coin_id", coin.id);

          if (metricsError) {
            console.error(`${coin.symbol}: Failed to update metrics:`, metricsError);
            continue;
          }

          console.log(
            `${coin.symbol}: Updated price ${asset.priceUsd}, market cap ${asset.marketCapUsd}`
          );
        } catch (error) {
          console.error(`${coin.symbol}: Individual sync failed:`, error);
          continue;
        }
      }
    } catch (error) {
      console.error("Failed to fetch prices from CoinCap:", error);
      throw error;
    }

    console.log(`✓ Intraday sync completed (${pricesUpdated} prices updated)`);
    return { success: true, coinsProcessed: coins.length, pricesUpdated };
  } catch (error) {
    console.error("✗ Intraday sync failed:", error);
    throw error;
  }
}
