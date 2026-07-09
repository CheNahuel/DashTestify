import { getSupabaseServiceClient } from "@/lib/supabase";
import { coincapClient } from "@/services/coincap/client";
import { calculateAllMetrics } from "@/services/metrics";
import * as queries from "@/database/queries";

interface InitialSyncInput {
  symbol: string;
  name: string;
  coincapId: string;
  coingeckoId?: string;
}

/**
 * Initial sync: download complete historical data for a coin.
 * This runs once per coin and should not be repeated.
 */
export async function syncInitialForCoin(input: InitialSyncInput) {
  const supabaseService = getSupabaseServiceClient();

  try {
    console.log(`Starting initial sync for ${input.symbol}...`);

    // 1. Create or get the coin
    let coin = await queries.getCoinBySymbol(input.symbol);

    if (!coin) {
      const { data, error } = await supabaseService
        .from("coins")
        .insert({
          symbol: input.symbol.toUpperCase(),
          name: input.name,
          coincap_id: input.coincapId,
          coingecko_id: input.coingeckoId || null,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create coin: ${error.message}`);
      }

      coin = data;
    }

    // 2. Fetch historical data from CoinCap
    console.log(`Fetching historical data for ${input.symbol}...`);
    const history = await coincapClient.fetchCoinHistory(input.coincapId);

    if (!history || history.length === 0) {
      throw new Error(`No historical data returned for ${input.symbol}`);
    }

    // 3. Convert to daily candles (collapse to 1 per day, use OHLC)
    const dailyCandles = history
      .reduce(
        (acc, h) => {
          const date = h.date;
          const existing = acc.find((c) => c.date === date);

          if (existing) {
            // Update OHLC
            existing.high = Math.max(existing.high, h.price);
            existing.low = Math.min(existing.low, h.price);
            existing.close = h.price; // Last price of day
            if (h.volume) existing.volume = (existing.volume || 0) + h.volume;
            existing.marketCap = h.marketCap; // Use latest
          } else {
            // New day
            acc.push({
              date,
              open: h.price,
              high: h.price,
              low: h.price,
              close: h.price,
              volume: h.volume || 0,
              marketCap: h.marketCap,
            });
          }

          return acc;
        },
        [] as Array<{
          date: string;
          open: number;
          high: number;
          low: number;
          close: number;
          volume?: number;
          marketCap?: number;
        }>
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Collapsed ${history.length} data points to ${dailyCandles.length} daily candles`);

    // 4. Insert daily candles into price_daily
    console.log(`Inserting ${dailyCandles.length} daily candles...`);
    for (const candle of dailyCandles) {
      const { error } = await supabaseService.from("price_daily").upsert({
        coin_id: coin.id,
        date: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || null,
        market_cap: candle.marketCap || null,
      });

      if (error) {
        console.error(`Failed to insert price for ${candle.date}:`, error);
        throw error;
      }
    }

    // 5. Calculate metrics
    console.log("Calculating metrics...");
    const metrics = calculateAllMetrics(
      dailyCandles.map((c) => ({
        date: c.date,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        marketCap: c.marketCap,
      }))
    );

    // Get latest price
    const latestCandle = dailyCandles[dailyCandles.length - 1];

    // 6. Upsert metrics
    const { error: metricsError } = await supabaseService
      .from("coin_metrics")
      .upsert({
        coin_id: coin.id,
        current_price: latestCandle.close,
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
        market_cap: latestCandle.marketCap || null,
        updated_at: new Date().toISOString(),
      });

    if (metricsError) {
      throw new Error(`Failed to insert metrics: ${metricsError.message}`);
    }

    console.log(`✓ Initial sync completed for ${input.symbol}`);
    return {
      success: true,
      coinId: coin.id,
      priceCount: dailyCandles.length,
    };
  } catch (error) {
    console.error(`✗ Initial sync failed for ${input.symbol}:`, error);
    throw error;
  }
}

/**
 * Batch sync multiple coins on initial load.
 */
export async function syncInitialBatch(coins: InitialSyncInput[]) {
  const results = [];

  for (const coin of coins) {
    try {
      const result = await syncInitialForCoin(coin);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        symbol: coin.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
