import { apiClient } from "@/lib/api-client";
import { Coin } from "../types/coin";

export const getCoins = async (): Promise<Coin[]> => {
  const response = await apiClient.get("/coins/markets", {
    params: {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 20,
      page: 1,
      sparkline: false,
    },
  });

  return response.data;
};