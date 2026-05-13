export type Coin = {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
  market_cap: number;
  total_volume: number;
  high_24h?: number;
  low_24h?: number;
};

export type CoinHistoryPoint = [timestamp: number, price: number];

export type CoinHistory = {
  prices: CoinHistoryPoint[];
};

export const COINCAP_HISTORY_INTERVALS = [
  "m1",
  "m5",
  "m15",
  "m30",
  "h1",
  "h2",
  "h6",
  "h12",
  "d1",
] as const;

export const INTERVAL_TO_MS: Record<CoinCapHistoryInterval, number> = {
  m1: 60 * 1000,
  m5: 5 * 60 * 1000,
  m15: 15 * 60 * 1000,
  m30: 30 * 60 * 1000,
  h1: 60 * 60 * 1000,
  h2: 2 * 60 * 60 * 1000,
  h6: 6 * 60 * 60 * 1000,
  h12: 12 * 60 * 60 * 1000,
  d1: 24 * 60 * 60 * 1000,
};

export type CoinCapHistoryInterval = (typeof COINCAP_HISTORY_INTERVALS)[number];

export const isCoinCapHistoryInterval = (
  value: string | null | undefined,
): value is CoinCapHistoryInterval =>
  COINCAP_HISTORY_INTERVALS.some((interval) => interval === value);

export const TIMEFRAMES = ["1H", "24H", "7D", "30D", "1Y"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const DEFAULT_TIMEFRAME: Timeframe = "7D";

export const TIMEFRAME_CONFIG: Record<
  Timeframe,
  {
    interval: CoinCapHistoryInterval;
    durationMs: number;
  }
> = {
  "1H": {
    interval: "m1",
    durationMs: 60 * 60 * 1000,
  },
  "24H": {
    interval: "h1",
    durationMs: 24 * 60 * 60 * 1000,
  },
  "7D": {
    interval: "h6",
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  "30D": {
    interval: "h12",
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
  "1Y": {
    interval: "d1",
    durationMs: 365 * 24 * 60 * 60 * 1000,
  },
};

export type CoinHistoryRequest = {
  interval: CoinCapHistoryInterval;
  start: number;
  end: number;
};

export const isTimeframe = (value: string | null | undefined): value is Timeframe =>
  TIMEFRAMES.some((timeframe) => timeframe === value);

export const getHistoryRequestForTimeframe = (
  timeframe: Timeframe,
  now = Date.now(),
): CoinHistoryRequest => {
  const config = TIMEFRAME_CONFIG[timeframe];
  const intervalMs = INTERVAL_TO_MS[config.interval];

  const normalizedEnd = Math.floor(now / intervalMs) * intervalMs;

  return {
    interval: config.interval,
    start: normalizedEnd - config.durationMs,
    end: normalizedEnd,
  };
};
