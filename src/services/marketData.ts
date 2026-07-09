import { getSupabaseServiceClient } from "@/lib/supabase";
import { coincapClient } from "@/services/coincap/client";
import { calculateAllMetrics } from "./metrics";
import * as queries from "@/database/queries";

/**
 * Refresh the latest price for a coin from CoinCap API.
 * This is the ONLY place outside of /sync that calls CoinCap.
 * Used when requested price data is older than 5 minutes.
 */
export async function refreshLatestPrice(coinId: string) {
  const supabaseService = getSupabaseServiceClient();

  // Get coin details
  const coin = await queries.getCoinById(coinId);
  if (!coin) {
    throw new Error(`Coin not found: ${coinId}`);
  }

  try {
    // Fetch current price from CoinCap
    const response = await coincapClient.fetchAssets([coin.coincap_id]);

    if (!response || response.length === 0) {
      throw new Error(`No data returned from CoinCap for ${coin.symbol}`);
    }

    const asset = response[0];
    const now = new Date();

    // Insert into price_intraday
    const { error: intradayError } = await supabaseService
      .from("price_intraday")
      .insert({
        coin_id: coinId,
        timestamp: now.toISOString(),
        price: parseFloat(asset.priceUsd),
        market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
        volume_24h: asset.volumeUsd24Hr ? parseFloat(asset.volumeUsd24Hr) : null,
        change_24h: asset.changePercent24Hr ? parseFloat(asset.changePercent24Hr) : null,
      });

    if (intradayError) {
      console.error(`Failed to insert intraday price for ${coin.symbol}:`, intradayError);
      throw intradayError;
    }

    // Get recent daily prices to recalculate metrics
    const startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last year
    const priceHistory = await queries.getPriceDailyForCoin(coinId, startDate, now);

    if (priceHistory.length > 0) {
      // Calculate metrics from historical data
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

      // Upsert coin_metrics
      const { error: metricsError } = await supabaseService
        .from("coin_metrics")
        .upsert({
          coin_id: coinId,
          current_price: parseFloat(asset.priceUsd),
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
          market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
          volume24h: asset.volumeUsd24Hr ? parseFloat(asset.volumeUsd24Hr) : null,
          updated_at: now.toISOString(),
        });

      if (metricsError) {
        console.error(`Failed to update metrics for ${coin.symbol}:`, metricsError);
        throw metricsError;
      }
    } else {
      // No daily data yet, just update current price in metrics
      const { error: metricsError } = await supabaseService
        .from("coin_metrics")
        .upsert({
          coin_id: coinId,
          current_price: parseFloat(asset.priceUsd),
          market_cap: asset.marketCapUsd ? parseFloat(asset.marketCapUsd) : null,
          volume24h: asset.volumeUsd24Hr ? parseFloat(asset.volumeUsd24Hr) : null,
          updated_at: now.toISOString(),
        });

      if (metricsError) {
        console.error(`Failed to update metrics for ${coin.symbol}:`, metricsError);
        throw metricsError;
      }
    }
  } catch (error) {
    console.error(`Error refreshing price for ${coin.symbol}:`, error);
    throw error;
  }
}
