/**
 * Pure calculation functions for crypto metrics.
 * No dependencies on databases or external APIs.
 */

export interface PriceCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  marketCap?: number;
}

/**
 * Calculate YTD return percentage.
 */
export function calculateYTDReturn(prices: PriceCandle[]): number | null {
  if (prices.length === 0) return null;

  const currentYear = new Date().getFullYear();
  const ytdPrices = prices.filter((p) => {
    const date = new Date(p.date);
    return date.getFullYear() === currentYear;
  });

  if (ytdPrices.length === 0) return null;

  const firstPrice = ytdPrices[0].open;
  const lastPrice = ytdPrices[ytdPrices.length - 1].close;

  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

/**
 * Calculate return for a specific period in months.
 */
export function calculatePeriodReturn(
  prices: PriceCandle[],
  months: number
): number | null {
  if (prices.length === 0) return null;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());

  const periodPrices = prices.filter((p) => {
    const date = new Date(p.date);
    return date >= periodStart;
  });

  if (periodPrices.length === 0) return null;

  const startPrice = periodPrices[0].open;
  const endPrice = periodPrices[periodPrices.length - 1].close;

  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Calculate All-Time High and its date.
 */
export function calculateATH(prices: PriceCandle[]): { ath: number; athDate: string } | null {
  if (prices.length === 0) return null;

  let maxPrice = -Infinity;
  let maxDate = "";

  prices.forEach((p) => {
    if (p.high > maxPrice) {
      maxPrice = p.high;
      maxDate = p.date;
    }
  });

  return { ath: maxPrice, athDate: maxDate };
}

/**
 * Calculate maximum drawdown percentage.
 */
export function calculateDrawdown(prices: PriceCandle[]): number | null {
  if (prices.length === 0) return null;

  let peak = -Infinity;
  let maxDrawdown = 0;

  prices.forEach((p) => {
    const high = p.high;
    if (high > peak) {
      peak = high;
    }

    const drawdown = ((peak - p.low) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return maxDrawdown;
}

/**
 * Calculate Exponential Moving Average (EMA).
 */
export function calculateEMA(
  prices: PriceCandle[],
  period: number
): number | null {
  if (prices.length < period) return null;

  const closes = prices.map((p) => p.close);
  const multiplier = 2 / (period + 1);

  let sma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < closes.length; i++) {
    sma = closes[i] * multiplier + sma * (1 - multiplier);
  }

  return sma;
}

/**
 * Calculate Relative Strength Index (RSI).
 */
export function calculateRSI(prices: PriceCandle[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;

  const closes = prices.map((p) => p.close);
  let gains = 0;
  let losses = 0;

  // Calculate average gains and losses
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI for subsequent periods
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

/**
 * Calculate volatility (standard deviation of daily returns).
 */
export function calculateVolatility(prices: PriceCandle[]): number | null {
  if (prices.length < 2) return null;

  const closes = prices.map((p) => p.close);
  const returns: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
    returns.push(ret);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  return volatility;
}

/**
 * Calculate all metrics from a series of price candles.
 */
export function calculateAllMetrics(prices: PriceCandle[]) {
  return {
    ytdReturn: calculateYTDReturn(prices),
    return1m: calculatePeriodReturn(prices, 1),
    return3m: calculatePeriodReturn(prices, 3),
    return6m: calculatePeriodReturn(prices, 6),
    return1y: calculatePeriodReturn(prices, 12),
    ath: calculateATH(prices)?.ath || null,
    athDate: calculateATH(prices)?.athDate || null,
    drawdown: calculateDrawdown(prices),
    ema20: calculateEMA(prices, 20),
    ema50: calculateEMA(prices, 50),
    ema200: calculateEMA(prices, 200),
    rsi14: calculateRSI(prices, 14),
    volatility: calculateVolatility(prices),
  };
}
