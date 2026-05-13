import { apiClient } from "@/lib/api-client";
import { getMockCoinHistory } from "./mockCryptoData";
import { CoinHistory, CoinHistoryRequest } from "../types/coin";

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

const buildHistoryCacheKey = (coinId: string, request: CoinHistoryRequest) =>
  `${coinId}:${request.interval}:${request.start}:${request.end}`;

export const getCoinHistoryFromCoinCap = async (
  coinId: string,
  request: CoinHistoryRequest,
): Promise<CoinHistory> => {
  if (!process.env.COINCAP_API_KEY) {
    return getMockCoinHistory(coinId, request);
  }

  const cacheKey = buildHistoryCacheKey(coinId, request);
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
          interval: request.interval,
          start: request.start,
          end: request.end,
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
    const fallbackHistory = getMockCoinHistory(coinId, request);
    historyCache.set(cacheKey, {
      data: fallbackHistory,
      fetchedAt: now,
    });
    return fallbackHistory;
  }
};
