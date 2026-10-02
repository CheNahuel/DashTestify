const DAY_MS = 24 * 60 * 60 * 1000;

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
