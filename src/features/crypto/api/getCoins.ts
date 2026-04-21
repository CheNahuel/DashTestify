import { Coin } from "../types/coin";

export const getCoins = async (): Promise<Coin[]> => {
  const response = await fetch("/api/coins/markets", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch coins: ${response.status}`);
  }

  return response.json();
};
