import * as queries from "./queries";
import { refreshLatestPrice } from "@/services/marketData";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get complete historical data for a coin including daily prices and calculated metrics.
 */
export async function getCoinHistory(coinId: string) {
  const coin = await queries.getCoinById(coinId);
  if (!coin) {
    return null;
  }

  // Get all daily prices
  const startDate = new Date(coin.created_at);
  const endDate = new Date();
  const priceHistory = await queries.getPriceDailyForCoin(coinId, startDate, endDate);

  // Get metrics
  const metrics = await queries.getCoinMetrics(coinId);

  return {
    coin,
    priceHistory,
    metrics,
  };
}

/**
 * Get pre-calculated metrics for a coin.
 * Used to avoid repeated calculation in the LLM.
 */
export async function getCoinMetrics(coinId: string) {
  return await queries.getCoinMetrics(coinId);
}

/**
 * Get the latest price for a coin.
 * If data is older than 5 minutes, triggers a refresh from the API.
 */
export async function getLatestPrice(coinId: string) {
  const metrics = await queries.getCoinMetrics(coinId);

  if (!metrics) {
    return null;
  }

  // Check if metrics are fresh (less than 5 minutes old)
  const updatedAtTime = new Date(metrics.updated_at).getTime();
  const now = Date.now();
  const ageMsTime = now - updatedAtTime;

  if (ageMsTime > CACHE_TTL_MS) {
    // Data is stale, refresh from API
    try {
      await refreshLatestPrice(coinId);
      // Fetch updated metrics
      return await queries.getCoinMetrics(coinId);
    } catch (error) {
      console.error(`Failed to refresh price for ${coinId}:`, error);
      // Fall back to stale data
      return metrics;
    }
  }

  return metrics;
}

/**
 * Compare multiple coins and return their metrics side-by-side.
 */
export async function compareCoins(coinIds: string[]) {
  if (!coinIds || coinIds.length === 0) {
    return [];
  }

  const comparisons = await queries.compareCoinsMetrics(coinIds);

  return comparisons.map((coin) => ({
    coinId: coin.coin_id,
    currentPrice: coin.current_price,
    ytdReturn: coin.ytd_return,
    return1m: coin.return_1m,
    return3m: coin.return_3m,
    return6m: coin.return_6m,
    return1y: coin.return_1y,
    ath: coin.ath,
    athDate: coin.ath_date,
    drawdown: coin.drawdown,
    ema20: coin.ema20,
    ema50: coin.ema50,
    ema200: coin.ema200,
    rsi14: coin.rsi14,
    volatility: coin.volatility,
    marketCap: coin.market_cap,
    volume24h: coin.volume24h,
    updatedAt: coin.updated_at,
  }));
}

/**
 * Get top moving coins by a specific metric.
 */
export async function getTopMovers(
  limit: number = 10,
  metric: "ytd" | "1m" | "3m" | "6m" | "1y" = "ytd"
) {
  const sortKeyMap = {
    ytd: "ytd_return" as const,
    "1m": "return_1m" as const,
    "3m": "return_3m" as const,
    "6m": "return_6m" as const,
    "1y": "return_1y" as const,
  };

  const sortKey = sortKeyMap[metric];
  const movers = await queries.getTopMoversByCoin(limit, sortKey);

  return movers.map((coin) => ({
    coinId: coin.coin_id,
    currentPrice: coin.current_price,
    return: coin[sortKey],
    marketCap: coin.market_cap,
  }));
}

/**
 * Get all supported coins.
 */
export async function getAllSupportedCoins() {
  return await queries.getAllCoins();
}

/**
 * Get data for a coin by its symbol (e.g., "BTC", "ETH").
 */
export async function getCoinBySymbol(symbol: string) {
  const coin = await queries.getCoinBySymbol(symbol);
  if (!coin) {
    return null;
  }

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    coincapId: coin.coincap_id,
    coingeckoId: coin.coingecko_id,
  };
}
