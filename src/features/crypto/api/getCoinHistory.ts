import { CoinHistory } from "../types/coin";

export const getCoinHistory = async (
  coinId: string,
  days: number,
  useMock = false,
): Promise<CoinHistory> => {
  const base = `/api/coins/${coinId}/history?days=${days}`;
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
