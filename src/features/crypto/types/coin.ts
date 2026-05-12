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

export type CoinCapHistoryInterval = (typeof COINCAP_HISTORY_INTERVALS)[number];

export const isCoinCapHistoryInterval = (
  value: string | null | undefined,
): value is CoinCapHistoryInterval =>
  COINCAP_HISTORY_INTERVALS.some((interval) => interval === value);
