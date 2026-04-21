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
