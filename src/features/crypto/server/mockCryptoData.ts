import { Coin, CoinCapHistoryInterval, CoinHistory } from "../types/coin";

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

const INTERVAL_CONFIG: Record<CoinCapHistoryInterval, { totalPoints: number; durationMs: number }> = {
  m1: { totalPoints: 60, durationMs: 60 * 60 * 1000 },
  m5: { totalPoints: 72, durationMs: 6 * 60 * 60 * 1000 },
  m15: { totalPoints: 96, durationMs: 24 * 60 * 60 * 1000 },
  m30: { totalPoints: 96, durationMs: 2 * 24 * 60 * 60 * 1000 },
  h1: { totalPoints: 168, durationMs: 7 * 24 * 60 * 60 * 1000 },
  h2: { totalPoints: 168, durationMs: 14 * 24 * 60 * 60 * 1000 },
  h6: { totalPoints: 120, durationMs: 30 * 24 * 60 * 60 * 1000 },
  h12: { totalPoints: 180, durationMs: 90 * 24 * 60 * 60 * 1000 },
  d1: { totalPoints: 365, durationMs: 365 * 24 * 60 * 60 * 1000 },
};

const getIntervalWeight = (interval: CoinCapHistoryInterval) =>
  (Object.keys(INTERVAL_CONFIG) as CoinCapHistoryInterval[]).indexOf(interval) + 1;

const getHistoricalBasePrice = (
  currentPrice: number,
  interval: CoinCapHistoryInterval,
  coinId: string,
) => {
  // Use coinId as seed for deterministic but varied historical data
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const intervalWeight = getIntervalWeight(interval);
  const random = (Math.sin(seed + intervalWeight) + 1) / 2;

  // Generate realistic starting price based on time period
  const volatility = 0.005 + intervalWeight * 0.035;
  const change = (random - 0.5) * 2 * volatility;
  return Math.max(currentPrice * (1 + change), currentPrice * 0.1);
};

const generateRealisticPriceMovement = (
  startPrice: number,
  endPrice: number,
  totalPoints: number,
  interval: CoinCapHistoryInterval,
  coinId: string,
) => {
  const prices = [];
  const intervalWeight = getIntervalWeight(interval);
  const volatility = 0.003 + intervalWeight * 0.012;
  const trendStrength = 0.05 + intervalWeight * 0.075;

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

export const getMockCoinHistory = (
  coinId: string,
  interval: CoinCapHistoryInterval,
): CoinHistory => {
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

  const { totalPoints, durationMs } = INTERVAL_CONFIG[interval];
  const step = durationMs / totalPoints;
  const now = Date.now();

  // Generate realistic historical data that leads to current price
  const startPrice = getHistoricalBasePrice(coin.current_price, interval, coinId);
  const pricePoints = generateRealisticPriceMovement(
    startPrice,
    coin.current_price,
    totalPoints,
    interval,
    coinId,
  );

  return {
    prices: pricePoints.map((price, index) => [
      Math.round(now - durationMs + step * index),
      price,
    ]),
  };
};
