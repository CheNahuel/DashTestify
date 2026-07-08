import { fetchCoinHistory } from "@/services/coincap";
import { getMockCoinHistory } from "./mockCryptoData";
import { CoinHistory, CoinHistoryRequest } from "../types/coin";

export const getCoinHistoryFromCoinCap = async (
  coinId: string,
  request: CoinHistoryRequest,
): Promise<CoinHistory> => {
  if (!process.env.COINCAP_API_KEY) {
    return getMockCoinHistory(coinId, request);
  }

  try {
    return await fetchCoinHistory(coinId, request);
  } catch (error) {
    console.warn(
      `Failed to fetch history for ${coinId}, using mock data:`,
      error
    );
    return getMockCoinHistory(coinId, request);
  }
};
