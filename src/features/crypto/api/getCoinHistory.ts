import { CoinHistory, CoinHistoryRequest } from "../types/coin";

export const getCoinHistory = async (
  coinId: string,
  request: CoinHistoryRequest,
  useMock = false,
): Promise<CoinHistory> => {
  const params = new URLSearchParams({
    interval: request.interval,
    start: String(request.start),
    end: String(request.end),
  });
  const base = `/api/coins/${coinId}/history?${params.toString()}`;
  const url = useMock ? `${base}&mock=1` : base;
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;

    throw new Error(errorBody?.message ?? `Failed to fetch coin history: ${response.status}`);
  }

  return response.json();
};
