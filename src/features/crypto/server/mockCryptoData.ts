import { Coin, CoinHistory } from "../types/coin";

const MOCK_COINS: Coin[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    current_price: 68450,
    price_change_percentage_24h: 2.31,
    image: "https://assets.coincap.io/assets/icons/btc@2x.png",
    market_cap: 1345000000000,
    total_volume: 28500000000,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    current_price: 3525,
    price_change_percentage_24h: 1.42,
    image: "https://assets.coincap.io/assets/icons/eth@2x.png",
    market_cap: 423000000000,
    total_volume: 14900000000,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    current_price: 148.8,
    price_change_percentage_24h: -0.82,
    image: "https://assets.coincap.io/assets/icons/sol@2x.png",
    market_cap: 66500000000,
    total_volume: 3200000000,
  },
  {
    id: "cardano",
    name: "Cardano",
    symbol: "ADA",
    current_price: 0.61,
    price_change_percentage_24h: 0.58,
    image: "https://assets.coincap.io/assets/icons/ada@2x.png",
    market_cap: 21800000000,
    total_volume: 540000000,
  },
  {
    id: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    current_price: 0.16,
    price_change_percentage_24h: -1.14,
    image: "https://assets.coincap.io/assets/icons/doge@2x.png",
    market_cap: 23200000000,
    total_volume: 970000000,
  },
];

const pointsForDays = (days: number) => {
  if (days <= 1) return 24;
  if (days <= 7) return 28;
  if (days <= 30) return 30;
  return 45;
};

export const getMockCoins = (): Coin[] => MOCK_COINS;

export const getMockCoinHistory = (coinId: string, days: number): CoinHistory => {
  const coin = MOCK_COINS.find((item) => item.id === coinId) ?? MOCK_COINS[0];
  const totalPoints = pointsForDays(days);
  const step = (days * 24 * 60 * 60 * 1000) / totalPoints;
  const now = Date.now();
  const amplitude = Math.max(coin.current_price * 0.08, 0.02);

  return {
    prices: Array.from({ length: totalPoints + 1 }, (_, index) => {
      const progress = index / totalPoints;
      const wave = Math.sin(progress * Math.PI * 3) * amplitude;
      const drift = (progress - 0.5) * coin.current_price * 0.03;
      const price = Math.max(coin.current_price + wave + drift, 0.0001);

      return [Math.round(now - days * 24 * 60 * 60 * 1000 + step * index), price];
    }),
  };
};
