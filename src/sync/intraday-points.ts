const DAY_MS = 24 * 60 * 60 * 1000;

/** Enough points to draw 24H. A fresh tail is still required for 1H. */
export const MIN_RECENT_INTRADAY_POINTS = 48;
export const INTRADAY_TAIL_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Skip the CoinGecko refill only when the last day is populated and the
 * newest point is still inside the 1H window's useful tail.
 */
export function intradayTailIsFresh(
  recentCount: number | null,
  newestTimestamp: string | number | Date | null,
  now = Date.now(),
): boolean {
  if (recentCount == null || recentCount < MIN_RECENT_INTRADAY_POINTS) return false;
  if (newestTimestamp == null) return false;

  const ageMs = now - new Date(newestTimestamp).getTime();
  return Number.isFinite(ageMs) && ageMs < INTRADAY_TAIL_MAX_AGE_MS;
}

export type MarketChartResponse = {
  prices?: Array<[number, number]>;
  market_caps?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
};

export type IntradayPoint = {
  timestamp: string;
  price: number;
  market_cap: number | null;
  volume_24h: number | null;
};

/**
 * CoinGecko `market_chart?days=1` returns about one point every five minutes.
 * Keep only the last 24 hours so the 1H and 24H charts have a series to read.
 */
export function pointsFromMarketChart(
  data: MarketChartResponse,
  now = Date.now(),
): IntradayPoint[] {
  const start = now - DAY_MS;
  const marketCaps = new Map((data.market_caps ?? []).map(([time, value]) => [time, value]));
  const volumes = new Map((data.total_volumes ?? []).map(([time, value]) => [time, value]));
  const seen = new Set<string>();
  const points: IntradayPoint[] = [];

  for (const [time, price] of data.prices ?? []) {
    if (time < start || time > now || !Number.isFinite(price)) continue;

    const timestamp = new Date(time).toISOString();
    if (seen.has(timestamp)) continue;
    seen.add(timestamp);

    points.push({
      timestamp,
      price,
      market_cap: marketCaps.get(time) ?? null,
      volume_24h: volumes.get(time) ?? null,
    });
  }

  return points;
}
