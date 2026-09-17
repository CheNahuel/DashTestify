import { getCryptoDataProvider, createMockProvider } from "@/services/crypto";
import { Coin } from "../types/coin";

export const getCoinsFromCoinCap = async (): Promise<Coin[]> => {
  try {
    return await getCryptoDataProvider().getAssets();
  } catch (error) {
    console.warn("Failed to fetch coins from configured provider, using mock data:", error);
    const mockProvider = createMockProvider();
    return mockProvider.getAssets();
  }
};
