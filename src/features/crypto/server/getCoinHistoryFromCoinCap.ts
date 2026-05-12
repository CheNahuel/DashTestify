import { apiClient } from "@/lib/api-client";
import { getMockCoinHistory } from "./mockCryptoData";
import { CoinCapHistoryInterval, CoinHistory } from "../types/coin";

const HISTORY_TTL_MS = 5 * 60_000;

const historyCache = new Map<
  string,
  {
    data: CoinHistory;
    fetchedAt: number;
  }
>();

type CoinCapHistoryPoint = {
  priceUsd: string;
  time: number;
};

const buildHistoryCacheKey = (coinId: string, interval: CoinCapHistoryInterval) =>
  `${coinId}:${interval}`;

export const getCoinHistoryFromCoinCap = async (
  coinId: string,
  interval: CoinCapHistoryInterval,
): Promise<CoinHistory> => {
  if (!process.env.COINCAP_API_KEY) {
    return getMockCoinHistory(coinId, interval);
  }

  const cacheKey = buildHistoryCacheKey(coinId, interval);
  const cached = historyCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < HISTORY_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await apiClient.get<{ data: CoinCapHistoryPoint[] }>(
      `/assets/${coinId}/history`,
      {
        params: {
          interval,
        },
      },
    );

    const data: CoinHistory = {
      prices: response.data.data.map((point) => [point.time, Number(point.priceUsd)]),
    };

    historyCache.set(cacheKey, {
      data,
      fetchedAt: now,
    });

    return data;
  } catch {
    if (cached) {
      return cached.data;
    }
    const fallbackHistory = getMockCoinHistory(coinId, interval);
    historyCache.set(cacheKey, {
      data: fallbackHistory,
      fetchedAt: now,
    });
    return fallbackHistory;
  }
};
