import { Coin } from "../types/coin";

export const getCoins = async (useMock = false): Promise<Coin[]> => {
  const url = useMock ? "/api/coins/markets?mock=1" : "/api/coins/markets";
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch coins: ${response.status}`);
  }

  return response.json();
};
