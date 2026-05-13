import { Coin, CoinCapHistoryInterval, CoinHistory, CoinHistoryRequest } from "../types/coin";

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

const INTERVAL_MINUTES: Record<CoinCapHistoryInterval, number> = {
  m1: 1,
  m5: 5,
  m15: 15,
  m30: 30,
  h1: 60,
  h2: 120,
  h6: 360,
  h12: 720,
  d1: 1440,
};

const getIntervalWeight = (interval: CoinCapHistoryInterval) =>
  (Object.keys(INTERVAL_MINUTES) as CoinCapHistoryInterval[]).indexOf(interval) + 1;

const getHistoricalBasePrice = (
  currentPrice: number,
  interval: CoinCapHistoryInterval,
  coinId: string,
) => {
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const intervalWeight = getIntervalWeight(interval);
  const random = (Math.sin(seed + intervalWeight) + 1) / 2;

  const volatility = 0.005 + intervalWeight * 0.035;
  const change = (random - 0.5) * 2 * volatility;
  return Math.max(currentPrice * (1 + change), currentPrice * 0.1);
};

const deterministicNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const generateRealisticPriceMovement = (
  startPrice: number,
  endPrice: number,
  totalPoints: number,
  interval: CoinCapHistoryInterval,
  coinId: string,
) => {
  const prices: number[] = [startPrice];
  const intervalWeight = getIntervalWeight(interval);
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseVolatility = 0.003 + intervalWeight * 0.0018;
  let price = startPrice;
  let drift = (Math.log(endPrice / startPrice) || 0) / Math.max(totalPoints, 1);
  let momentum = 0;

  for (let i = 1; i <= totalPoints; i++) {
    const progress = i / totalPoints;
    const regimeShift =
      Math.sin(seed * 0.11 + progress * Math.PI * 6) * baseVolatility * 0.7 +
      Math.cos(seed * 0.07 + progress * Math.PI * 13) * baseVolatility * 0.45;
    const volatilityCluster =
      baseVolatility *
      (0.75 + Math.abs(Math.sin(seed * 0.13 + progress * Math.PI * 9)) * 1.8);
    const jaggedMove =
      (deterministicNoise(seed + i * 17) - 0.5) * volatilityCluster +
      (deterministicNoise(seed + i * 31) - 0.5) * volatilityCluster * 0.55;
    const shockDirection = deterministicNoise(seed + i * 43) > 0.5 ? 1 : -1;
    const shock =
      i % Math.max(9, Math.floor(totalPoints / 7)) === 0
        ? shockDirection * volatilityCluster * (1.8 + deterministicNoise(seed + i * 59) * 2.5)
        : 0;
    const anchorPull = Math.log(endPrice / Math.max(price, 0.0001)) / (totalPoints - i + 1);

    momentum = momentum * 0.55 + jaggedMove + shock;
    drift = drift * 0.92 + anchorPull * 0.08;
    price = Math.max(
      price * Math.exp(drift + regimeShift + momentum),
      Math.max(endPrice, startPrice) * 0.03,
    );
    prices.push(price);
  }

  prices[prices.length - 1] = endPrice;
  return prices;
};

export const getMockCoinHistory = (
  coinId: string,
  request: CoinHistoryRequest,
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

  const durationMs = Math.max(request.end - request.start, 60 * 1000);
  const intervalMs = INTERVAL_MINUTES[request.interval] * 60 * 1000;
  const totalPoints = Math.max(2, Math.min(365, Math.ceil(durationMs / intervalMs)));
  const step = durationMs / totalPoints;

  // Generate realistic historical data that leads to current price
  const startPrice = getHistoricalBasePrice(coin.current_price, request.interval, coinId);
  const pricePoints = generateRealisticPriceMovement(
    startPrice,
    coin.current_price,
    totalPoints,
    request.interval,
    coinId,
  );

  return {
    prices: pricePoints.map((price, index) => [
      Math.round(request.start + step * index),
      price,
    ]),
  };
};
