import { getSupabaseServiceClient } from "@/lib/supabase";
import { coincapClient } from "@/services/coincap/client";
import { calculateAllMetrics } from "@/services/metrics";
import * as queries from "@/database/queries";

/**
 * Daily sync: fetch and insert the previous day's candle for each coin.
 * Runs once per day (e.g., at 1 AM UTC).
 * Also recalculates metrics for all coins.
 */
export async function syncDaily() {
  const supabaseService = getSupabaseServiceClient();

  try {
    console.log("Starting daily sync...");

    // Get all coins
    const coins = await queries.getAllCoins();

    if (coins.length === 0) {
      console.log("No coins to sync");
      return { success: true, coinsProcessed: 0 };
    }

    console.log(`Processing ${coins.length} coins...`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    for (const coin of coins) {
      try {
        // Check if we already have yesterday's data
        const { data: existingData } = await supabaseService
          .from("price_daily")
          .select("id")
          .eq("coin_id", coin.id)
          .eq("date", yesterdayStr)
          .single();

        if (existingData) {
          console.log(`${coin.symbol}: Data for ${yesterdayStr} already exists, skipping`);
          continue;
        }

        // Fetch yesterday's data from CoinCap
        const history = await coincapClient.fetchCoinHistory(coin.coincap_id, {
          start: yesterday.getTime(),
          end: new Date().getTime(),
        });

        const yesterdayData = history.find((h) => h.date === yesterdayStr);

        if (!yesterdayData) {
          console.log(`${coin.symbol}: No data available for ${yesterdayStr}`);
          continue;
        }

        // Insert daily candle
        const { error: priceError } = await supabaseService
          .from("price_daily")
          .insert({
            coin_id: coin.id,
            date: yesterdayStr,
            open: yesterdayData.price, // Simplified: use single price as OHLC
            high: yesterdayData.price,
            low: yesterdayData.price,
            close: yesterdayData.price,
            volume: yesterdayData.volume || null,
            market_cap: yesterdayData.marketCap || null,
          });

        if (priceError) {
          console.error(`${coin.symbol}: Failed to insert price:`, priceError);
          continue;
        }

        console.log(`${coin.symbol}: Inserted candle for ${yesterdayStr}`);
      } catch (error) {
        console.error(`${coin.symbol}: Sync failed:`, error);
        continue;
      }
    }

    // Recalculate metrics for all coins
    console.log("Recalculating metrics for all coins...");
    await recalculateAllMetrics();

    console.log("✓ Daily sync completed");
    return { success: true, coinsProcessed: coins.length };
  } catch (error) {
    console.error("✗ Daily sync failed:", error);
    throw error;
  }
}

/**
 * Recalculate metrics for all coins based on their price_daily history.
 */
export async function recalculateAllMetrics() {
  const supabaseService = getSupabaseServiceClient();
  const coins = await queries.getAllCoins();

  for (const coin of coins) {
    try {
      // Get all daily prices for this coin
      const startDate = new Date(coin.created_at);
      const endDate = new Date();
      const priceHistory = await queries.getPriceDailyForCoin(coin.id, startDate, endDate);

      if (priceHistory.length === 0) {
        console.log(`${coin.symbol}: No price history, skipping metrics`);
        continue;
      }

      // Calculate metrics
      const metrics = calculateAllMetrics(
        priceHistory.map((p) => ({
          date: p.date,
          open: parseFloat(p.open),
          high: parseFloat(p.high),
          low: parseFloat(p.low),
          close: parseFloat(p.close),
          volume: p.volume ? parseFloat(p.volume) : undefined,
          marketCap: p.market_cap ? parseFloat(p.market_cap) : undefined,
        }))
      );

      const latestCandle = priceHistory[priceHistory.length - 1];

      // Upsert metrics
      const { error: metricsError } = await supabaseService
        .from("coin_metrics")
        .upsert({
          coin_id: coin.id,
          current_price: parseFloat(latestCandle.close),
          ytd_return: metrics.ytdReturn,
          return_1m: metrics.return1m,
          return_3m: metrics.return3m,
          return_6m: metrics.return6m,
          return_1y: metrics.return1y,
          ath: metrics.ath,
          ath_date: metrics.athDate,
          drawdown: metrics.drawdown,
          ema20: metrics.ema20,
          ema50: metrics.ema50,
          ema200: metrics.ema200,
          rsi14: metrics.rsi14,
          volatility: metrics.volatility,
          market_cap: latestCandle.market_cap ? parseFloat(latestCandle.market_cap) : null,
          updated_at: new Date().toISOString(),
        });

      if (metricsError) {
        console.error(`${coin.symbol}: Failed to update metrics:`, metricsError);
        continue;
      }

      console.log(`${coin.symbol}: Metrics recalculated`);
    } catch (error) {
      console.error(`${coin.symbol}: Metric calculation failed:`, error);
      continue;
    }
  }
}
