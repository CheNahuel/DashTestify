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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchHistoryError {
  response?: {
    status: number;
    data?: {
      error?: {
        message?: string;
        hint_tool?: string;
      };
    };
  };
  message?: string;
}

async function fetchCoinHistoryWithRetry(
  coinId: string,
  maxAttempts: number = 3
): Promise<unknown[]> {
  let lastError: FetchHistoryError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await coincapClient.fetchCoinHistory(coinId);
    } catch (error: unknown) {
      lastError = error as FetchHistoryError;
      const status = lastError.response?.status;

      if ((status === 403 || status === 429) && attempt < maxAttempts) {
        const errorData = lastError.response?.data?.error;
        const retryAfterMs =
          (errorData?.hint_tool?.match(/(\d+)/)?.[0] &&
            parseInt(errorData.hint_tool.match(/(\d+)/)?.[0])) ||
          65000;

        console.log(
          `Rate limited (HTTP ${status}), retrying in ${retryAfterMs}ms (attempt ${attempt}/${maxAttempts})...`
        );
        await sleep(retryAfterMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
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

    // 1.5. Check if already synced
    const latestPrice = await queries.getLatestPriceDailyForCoin(coin.id);
    const existingMetrics = await queries.getCoinMetrics(coin.id);

    if (latestPrice && existingMetrics) {
      console.log(`✓ ${input.symbol}: Already synced, skipping`);
      return {
        success: true,
        coinId: coin.id,
        priceCount: 0,
      };
    }

    // 2. Fetch historical data from CoinCap
    console.log(`Fetching historical data for ${input.symbol}...`);
    const history = await fetchCoinHistoryWithRetry(input.coincapId);

    if (!history || history.length === 0) {
      throw new Error(`No historical data returned for ${input.symbol}`);
    }

    // Map CoinCap response {time, priceUsd} to {date, price}
    interface CoinCapHistoryPoint {
      time: number;
      priceUsd: string;
    }
    const mappedHistory = (history as CoinCapHistoryPoint[]).map((h) => ({
      date: new Date(h.time).toISOString().split('T')[0],
      price: Number(h.priceUsd),
    }));

    // 3. Convert to daily candles (collapse to 1 per day, use OHLC)
    const dailyCandles = mappedHistory
      .reduce(
        (acc, h) => {
          const date = h.date;
          const existing = acc.find((c) => c.date === date);

          if (existing) {
            // Update OHLC
            existing.high = Math.max(existing.high, h.price);
            existing.low = Math.min(existing.low, h.price);
            existing.close = h.price; // Last price of day
          } else {
            // New day
            acc.push({
              date,
              open: h.price,
              high: h.price,
              low: h.price,
              close: h.price,
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
        }>
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Collapsed ${history.length} data points to ${dailyCandles.length} daily candles`);

    // 4. Insert daily candles into price_daily
    console.log(`Inserting ${dailyCandles.length} daily candles...`);
    for (const candle of dailyCandles) {
      const { error } = await supabaseService.from("price_daily").upsert(
        {
          coin_id: coin.id,
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: null,
          market_cap: null,
        },
        { onConflict: "coin_id,date" }
      );

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
      }))
    );

    // Get latest price
    const latestCandle = dailyCandles[dailyCandles.length - 1];

    // 6. Upsert metrics
    const { error: metricsError } = await supabaseService
      .from("coin_metrics")
      .upsert(
        {
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
          market_cap: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "coin_id" }
      );

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
 * Batch sync multiple coins on initial load with rate-limit throttling.
 * Spaces requests ~13 seconds apart to stay under CoinCap's 5 requests/min free tier.
 */
export async function syncInitialBatch(coins: InitialSyncInput[]) {
  const results = [];
  const throttleMs = 13000; // 13s * 5 coins ≈ 65s per cycle, safely under 5/min limit

  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];

    try {
      const result = await syncInitialForCoin(coin);
      results.push(result);

      // Throttle between requests only if the coin wasn't already synced
      // (skip check in syncInitialForCoin returns priceCount=0 for already-synced)
      if (result.success && result.priceCount > 0 && i < coins.length - 1) {
        console.log(`Waiting ${throttleMs / 1000}s before next request...`);
        await sleep(throttleMs);
      }
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
