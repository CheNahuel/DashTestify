import { coincapClient } from './client';

export interface CoinHistoryRequest {
  interval: string;
  start: number;
  end: number;
}

export interface CoinHistory {
  prices: Array<[number, number]>;
}

interface CoinCapHistoryPoint {
  priceUsd: string;
  time: number;
}

export async function fetchCoinHistory(
  coinId: string,
  request: CoinHistoryRequest
): Promise<CoinHistory> {
  const historyData = await coincapClient.fetchCoinHistory(
    coinId,
    request.interval
  );

  const prices: Array<[number, number]> = (historyData as CoinCapHistoryPoint[]).map(
    (point) => [point.time, Number(point.priceUsd)]
  );

  return { prices };
}
