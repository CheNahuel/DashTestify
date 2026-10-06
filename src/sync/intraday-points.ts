const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * CoinGecko `days=1` is about one point every five minutes, so a full hour
 * is ~12 points. Ten still draws 1H if a slot or two is missing.
 * The count must be rows inside the last hour, not the last day: 48 older
 * rows plus one fresh snapshot leave the 1H query empty.
 */
export const MIN_LAST_HOUR_POINTS = 10;

/**
 * Matches the intended 5-minute scheduler. A newest point older than this
 * will fall out of the 1H window before the next run. This cannot keep 1H
 * filled if the job itself only runs every couple of hours.
 */
export const INTRADAY_TAIL_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Skip the CoinGecko refill only when the current 1H window already has
 * enough points and the newest one is still recent.
 */
export function intradayTailIsFresh(
  lastHourCount: number | null,
  newestTimestamp: string | number | Date | null,
  now = Date.now(),
): boolean {
  if (lastHourCount == null || lastHourCount < MIN_LAST_HOUR_POINTS) return false;
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
