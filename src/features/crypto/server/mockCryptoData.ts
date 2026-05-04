import { Coin, CoinHistory } from "../types/coin";

const CRYPTO_DATA = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    basePrice: 79198,
    image: "https://assets.coincap.io/assets/icons/btc@2x.png",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    basePrice: 2395,
    image: "https://assets.coincap.io/assets/icons/eth@2x.png",
  },
  {
    id: "tether",
    name: "Tether USDt",
    symbol: "USDT",
    basePrice: 1.0,
    image: "https://assets.coincap.io/assets/icons/usdt@2x.png",
  },
  {
    id: "xrp",
    name: "XRP",
    symbol: "XRP",
    basePrice: 1.445,
    image: "https://assets.coincap.io/assets/icons/xrp@2x.png",
  },
  {
    id: "binance-coin",
    name: "BNB",
    symbol: "BNB",
    basePrice: 639,
    image: "https://assets.coincap.io/assets/icons/bnb@2x.png",
  },
  {
    id: "usd-coin",
    name: "USDC",
    symbol: "USDC",
    basePrice: 1.0,
    image: "https://assets.coincap.io/assets/icons/usdc@2x.png",
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    basePrice: 87.98,
    image: "https://assets.coincap.io/assets/icons/sol@2x.png",
  },
  {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    basePrice: 0.3233,
    image: "https://assets.coincap.io/assets/icons/trx@2x.png",
  },
  {
    id: "steth",
    name: "Lido Staked ETH",
    symbol: "STETH",
    basePrice: 2387,
    image: "https://assets.coincap.io/assets/icons/steth@2x.png",
  },
  {
    id: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    basePrice: 0.1006,
    image: "https://assets.coincap.io/assets/icons/doge@2x.png",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    symbol: "HYPE",
    basePrice: 43.07,
    image: "https://assets.coincap.io/assets/icons/hype@2x.png",
  },
  {
    id: "lido-finance-wsteth",
    name: "Lido wstETH",
    symbol: "WSTETH",
    basePrice: 2943,
    image: "https://assets.coincap.io/assets/icons/wsteth@2x.png",
  },
  {
    id: "unus-sed-leo",
    name: "UNUS SED LEO",
    symbol: "LEO",
    basePrice: 10.37,
    image: "https://assets.coincap.io/assets/icons/leo@2x.png",
  },
  {
    id: "wrapped-bitcoin",
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    basePrice: 78990,
    image: "https://assets.coincap.io/assets/icons/wbtc@2x.png",
  },
  {
    id: "cardano",
    name: "Cardano",
    symbol: "ADA",
    basePrice: 0.2555,
    image: "https://assets.coincap.io/assets/icons/ada@2x.png",
  },
  {
    id: "bitcoin-cash",
    name: "Bitcoin Cash",
    symbol: "BCH",
    basePrice: 456.1,
    image: "https://assets.coincap.io/assets/icons/bch@2x.png",
  },
  {
    id: "weth",
    name: "WETH",
    symbol: "WETH",
    basePrice: 2392,
    image: "https://assets.coincap.io/assets/icons/weth@2x.png",
  },
  {
    id: "monero",
    name: "Monero",
    symbol: "XMR",
    basePrice: 390.26,
    image: "https://assets.coincap.io/assets/icons/xmr@2x.png",
  },
  {
    id: "chainlink",
    name: "Chainlink",
    symbol: "LINK",
    basePrice: 9.56,
    image: "https://assets.coincap.io/assets/icons/link@2x.png",
  },
  {
    id: "zcash",
    name: "Zcash",
    symbol: "ZEC",
    basePrice: 362.6,
    image: "https://assets.coincap.io/assets/icons/zec@2x.png",
  },
];

const generateRandomCoins = (): Coin[] => {
  return CRYPTO_DATA.map((crypto) => {
    const volatility = Math.random() * 0.1 + 0.05; // 5-15% volatility
    const change = (Math.random() - 0.5) * 2 * volatility;
    const currentPrice = crypto.basePrice * (1 + change);
    const priceChange24h = (Math.random() - 0.5) * 10; // -5% to +5%

    return {
      id: crypto.id,
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
  if (days < 0.1) return 12; // 5-min intervals for 1H
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
  const volatility = days < 0.1 ? 0.005 : days <= 1 ? 0.05 : days <= 7 ? 0.15 : days <= 30 ? 0.25 : 0.35;
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
  const volatility = days < 0.1 ? 0.003 : days <= 1 ? 0.02 : days <= 7 ? 0.05 : days <= 30 ? 0.08 : 0.12;
  const trendStrength = days < 0.1 ? 0.05 : days <= 1 ? 0.1 : days <= 7 ? 0.3 : days <= 30 ? 0.5 : 0.7;

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
