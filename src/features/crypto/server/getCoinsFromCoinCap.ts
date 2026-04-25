import { apiClient } from "@/lib/api-client";
import { getMockCoins } from "./mockCryptoData";
import { Coin } from "../types/coin";

const COINS_TTL_MS = 60_000;

let coinsCache: { data: Coin[]; fetchedAt: number } | null = null;

type CoinCapAsset = {
  id: string;
  name: string;
  symbol: string;
  priceUsd: string;
  changePercent24Hr: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
};

const toNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapAssetToCoin = (asset: CoinCapAsset): Coin => {
  const symbol = asset.symbol?.toLowerCase() || "unknown";
  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    current_price: toNumber(asset.priceUsd),
    price_change_percentage_24h: toNumber(asset.changePercent24Hr),
    image: `https://assets.coincap.io/assets/icons/${symbol}@2x.png`,
    market_cap: toNumber(asset.marketCapUsd),
    total_volume: toNumber(asset.volumeUsd24Hr),
  };
};

export const getCoinsFromCoinCap = async (): Promise<Coin[]> => {
  const now = Date.now();

  if (coinsCache && now - coinsCache.fetchedAt < COINS_TTL_MS) {
    return coinsCache.data;
  }

  try {
    const response = await apiClient.get<{ data: CoinCapAsset[] }>("/assets", {
      params: {
        limit: 20,
      },
    });

    const coins = response.data.data.map(mapAssetToCoin);

    coinsCache = {
      data: coins,
      fetchedAt: now,
    };

    return coins;
  } catch {
    if (coinsCache) {
      return coinsCache.data;
    }
    const fallbackCoins = getMockCoins();
    coinsCache = {
      data: fallbackCoins,
      fetchedAt: now,
    };
    return fallbackCoins;
  }
};
