import { apiClient } from "@/lib/api-client";
import { getMockCoinHistory } from "./mockCryptoData";
import { CoinHistory } from "../types/coin";

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

const buildHistoryCacheKey = (coinId: string, days: number) => `${coinId}:${days}`;

const getHistoryInterval = (days: number) => {
  if (days < 0.1) return "m5";
  if (days <= 1) return "h1";
  if (days <= 7) return "h6";
  return "d1";
};

export const getCoinHistoryFromCoinCap = async (
  coinId: string,
  days: number,
): Promise<CoinHistory> => {
  if (!process.env.COINCAP_API_KEY) {
    return getMockCoinHistory(coinId, days);
  }

  const cacheKey = buildHistoryCacheKey(coinId, days);
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
          interval: getHistoryInterval(days),
          start: now - days * 24 * 60 * 60 * 1000,
          end: now,
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
    const fallbackHistory = getMockCoinHistory(coinId, days);
    historyCache.set(cacheKey, {
      data: fallbackHistory,
      fetchedAt: now,
    });
    return fallbackHistory;
  }
};
