import type { CoinHistory, CoinHistoryRequest } from "@/features/crypto/types/coin";

/**
 * Dashboard ranges that need sub-daily points.
 * 1H requests m1 and 24H requests h1. 7D (h6), 30D (h12), and 1Y (d1)
 * stay on price_daily.
 */
const INTRADAY_HISTORY_INTERVALS = new Set(["m1", "h1"]);

export function usesIntradayHistory(interval: string): boolean {
  return INTRADAY_HISTORY_INTERVALS.has(interval);
}

export type DailyPriceRow = {
  date: string;
  close: string | number;
};

export type IntradayPriceRow = {
  timestamp: string;
  price: string | number;
};

export type PriceHistoryReaders = {
  getPriceDailyForCoin: (coinId: string, start: Date, end: Date) => Promise<DailyPriceRow[]>;
  getPriceIntradayForCoin: (
    coinId: string,
    start: Date,
    end: Date,
  ) => Promise<IntradayPriceRow[]>;
};

export async function readPriceHistory(
  coinId: string,
  request: CoinHistoryRequest,
  readers: PriceHistoryReaders,
): Promise<CoinHistory> {
  const start = new Date(request.start);
  const end = new Date(request.end);

  if (usesIntradayHistory(request.interval)) {
    const rows = await readers.getPriceIntradayForCoin(coinId, start, end);
    return {
      prices: rows.map((row) => [new Date(row.timestamp).getTime(), Number(row.price)]),
    };
  }

  const rows = await readers.getPriceDailyForCoin(coinId, start, end);
  return {
    prices: rows.map((row) => [new Date(row.date).getTime(), Number(row.close)]),
  };
}
