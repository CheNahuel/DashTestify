import { getCryptoDataProvider, createMockProvider } from "@/services/crypto";
import { CoinHistory, CoinHistoryRequest } from "../types/coin";

export const getCoinHistoryFromCoinCap = async (
  coinId: string,
  request: CoinHistoryRequest,
): Promise<CoinHistory> => {
  try {
    return await getCryptoDataProvider().getHistory(coinId, request);
  } catch (error) {
    console.warn(
      `Failed to fetch history for ${coinId}, using mock data:`,
      error
    );
    const mockProvider = createMockProvider();
    return mockProvider.getHistory(coinId, request);
  }
};
