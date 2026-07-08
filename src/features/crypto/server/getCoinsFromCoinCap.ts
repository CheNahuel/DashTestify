import { fetchCoins } from "@/services/coincap";
import { getMockCoins } from "./mockCryptoData";
import { Coin } from "../types/coin";

export const getCoinsFromCoinCap = async (): Promise<Coin[]> => {
  if (!process.env.COINCAP_API_KEY) {
    return getMockCoins();
  }

  try {
    return await fetchCoins();
  } catch (error) {
    console.warn("Failed to fetch coins from CoinCap, using mock data:", error);
    return getMockCoins();
  }
};
