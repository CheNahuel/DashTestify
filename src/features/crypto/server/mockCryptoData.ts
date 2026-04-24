import { Coin, CoinHistory } from "../types/coin";

const CRYPTO_DATA = [
  {
    name: "Bitcoin",
    symbol: "BTC",
    basePrice: 68000,
    image: "https://assets.coincap.io/assets/icons/btc@2x.png",
  },
  {
    name: "Ethereum",
    symbol: "ETH",
    basePrice: 3500,
    image: "https://assets.coincap.io/assets/icons/eth@2x.png",
  },
  {
    name: "Solana",
    symbol: "SOL",
    basePrice: 145,
    image: "https://assets.coincap.io/assets/icons/sol@2x.png",
  },
  {
    name: "Cardano",
    symbol: "ADA",
    basePrice: 0.6,
    image: "https://assets.coincap.io/assets/icons/ada@2x.png",
  },
  {
    name: "Dogecoin",
    symbol: "DOGE",
    basePrice: 0.15,
    image: "https://assets.coincap.io/assets/icons/doge@2x.png",
  },
  {
    name: "Chainlink",
    symbol: "LINK",
    basePrice: 18,
    image: "https://assets.coincap.io/assets/icons/link@2x.png",
  },
  {
    name: "Polkadot",
    symbol: "DOT",
    basePrice: 8.5,
    image: "https://assets.coincap.io/assets/icons/dot@2x.png",
  },
  {
    name: "Avalanche",
    symbol: "AVAX",
    basePrice: 42,
    image: "https://assets.coincap.io/assets/icons/avax@2x.png",
  },
  {
    name: "Polygon",
    symbol: "MATIC",
    basePrice: 0.85,
    image: "https://assets.coincap.io/assets/icons/matic@2x.png",
  },
  {
    name: "Uniswap",
    symbol: "UNI",
    basePrice: 12,
    image: "https://assets.coincap.io/assets/icons/uni@2x.png",
  },
];

const generateRandomCoins = (): Coin[] => {
  return CRYPTO_DATA.map((crypto) => {
    const id = crypto.symbol.toLowerCase();
    const volatility = Math.random() * 0.1 + 0.05; // 5-15% volatility
    const change = (Math.random() - 0.5) * 2 * volatility;
    const currentPrice = crypto.basePrice * (1 + change);
    const priceChange24h = (Math.random() - 0.5) * 10; // -5% to +5%

    return {
      id,
      name: crypto.name,
      symbol: crypto.symbol,
      current_price: Math.max(currentPrice, 0.0001),
      price_change_percentage_24h: priceChange24h,
      image: crypto.image,
      market_cap: Math.floor(currentPrice * (Math.random() * 100000000 + 10000000)),
      total_volume: Math.floor(currentPrice * (Math.random() * 10000000 + 1000000)),
    };
  });
};

// Cache coins to ensure consistency across requests
let cachedCoins: Coin[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getMockCoins = (): Coin[] => {
  const now = Date.now();
  if (!cachedCoins || now - cacheTimestamp > CACHE_DURATION) {
    cachedCoins = generateRandomCoins();
    cacheTimestamp = now;
  }
  return cachedCoins;
};

const pointsForDays = (days: number) => {
  if (days <= 1) return 24; // Hourly for 24H
  if (days <= 7) return days * 24; // Daily for 7D
  if (days <= 30) return days * 4; // 6-hour intervals for 30D
  return days * 2; // 12-hour intervals for 90D
};

const getHistoricalBasePrice = (currentPrice: number, days: number, coinId: string) => {
  // Use coinId as seed for deterministic but varied historical data
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (Math.sin(seed + days) + 1) / 2; // Deterministic random based on coin and days

  // Generate realistic starting price based on time period
  const volatility = days <= 1 ? 0.05 : days <= 7 ? 0.15 : days <= 30 ? 0.25 : 0.35;
  const change = (random - 0.5) * 2 * volatility;
  return Math.max(currentPrice * (1 + change), currentPrice * 0.1);
};

const generateRealisticPriceMovement = (
  startPrice: number,
  endPrice: number,
  totalPoints: number,
  days: number,
  coinId: string,
) => {
  const prices = [];
  const volatility = days <= 1 ? 0.02 : days <= 7 ? 0.05 : days <= 30 ? 0.08 : 0.12;
  const trendStrength = days <= 1 ? 0.1 : days <= 7 ? 0.3 : days <= 30 ? 0.5 : 0.7;

  // Use coinId for deterministic noise
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  for (let i = 0; i <= totalPoints; i++) {
    const progress = i / totalPoints;

    // Base trend from start to end price
    const trendPrice = startPrice + (endPrice - startPrice) * Math.pow(progress, trendStrength);

    // Add deterministic noise based on coin and position
    const noiseSeed = seed + i * 0.1;
    const noise = (Math.sin(noiseSeed) + Math.cos(noiseSeed * 1.3)) * 0.5;
    const randomWalk = noise * volatility * trendPrice;

    const price = Math.max(trendPrice + randomWalk, 0.0001);
    prices.push(price);
  }

  return prices;
};

export const getMockCoinHistory = (coinId: string, days: number): CoinHistory => {
  const coins = getMockCoins();
  const coin = coins.find((item) => item.id === coinId);

  if (!coin) {
    // Fallback for unknown coins
    return {
      prices: Array.from({ length: 24 }, (_, i) => [
        Date.now() - (23 - i) * 60 * 60 * 1000,
        100 + Math.sin(i * 0.5) * 10,
      ]),
    };
  }

  const totalPoints = pointsForDays(days);
  const step = (days * 24 * 60 * 60 * 1000) / totalPoints;
  const now = Date.now();

  // Generate realistic historical data that leads to current price
  const startPrice = getHistoricalBasePrice(coin.current_price, days, coinId);
  const pricePoints = generateRealisticPriceMovement(
    startPrice,
    coin.current_price,
    totalPoints,
    days,
    coinId,
  );

  return {
    prices: pricePoints.map((price, index) => [
      Math.round(now - days * 24 * 60 * 60 * 1000 + step * index),
      price,
    ]),
  };
};
