import type { CryptoDataProvider } from "../types";
import type { Coin, CoinHistory, CoinHistoryRequest } from "@/features/crypto/types/coin";
import type { ContextData } from "@/features/crypto/components/CryptoAIAnalyst/types";
import { getMockCoins, getMockCoinHistory } from "@/features/crypto/server/mockCryptoData";

export function createMockProvider(): CryptoDataProvider {
  return {
    async getAssets(): Promise<Coin[]> {
      return getMockCoins();
    },

    async getAsset(id: string): Promise<Coin | null> {
      const coins = await getMockCoins();
      return coins.find((c) => c.id === id) || null;
    },

    async getHistory(assetId: string, request: CoinHistoryRequest): Promise<CoinHistory> {
      return getMockCoinHistory(assetId, request);
    },

    async fetchMarketData(query: string): Promise<{ context: ContextData; endpoints: string[] }> {
      void query;
      // Mock provider doesn't support AI analyst queries
      // This should only be called if Supabase/CoinCap fail, which would already be an error
      throw new Error("Mock provider does not support market data queries");
    },
  };
}
