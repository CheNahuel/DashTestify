import { CoinHistory } from "../types/coin";

export const getCoinHistory = async (coinId: string, days: number): Promise<CoinHistory> => {
  const response = await fetch(`/api/coins/${coinId}/history?days=${days}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;

    throw new Error(errorBody?.message ?? `Failed to fetch coin history: ${response.status}`);
  }

  return response.json();
};
