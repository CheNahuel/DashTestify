import type { CryptoDataProvider } from '../types';
import type { Coin, CoinHistory, CoinHistoryRequest } from '@/features/crypto/types/coin';
import type { ContextData } from '@/features/crypto/components/CryptoAIAnalyst/types';
import { coincapClient, fetchCoins, fetchCoinHistory } from '@/services/coincap';

export function createCoinCapProvider(): CryptoDataProvider {
  return {
    async getAssets(): Promise<Coin[]> {
      return fetchCoins();
    },

    async getAsset(id: string): Promise<Coin | null> {
      const assets = await fetchCoins();
      return assets.find((a) => a.id === id) || null;
    },

    async getHistory(assetId: string, request: CoinHistoryRequest): Promise<CoinHistory> {
      return fetchCoinHistory(assetId, request);
    },

    async fetchMarketData(userQuery: string): Promise<{ context: ContextData; endpoints: string[] }> {
      const { context: rawContext, endpoints } = await coincapClient.fetchMarketDataForQuery(userQuery);

      // Convert raw context to AI-friendly format
      const context: ContextData = {
        assets: rawContext.assets ? { list: rawContext.assets } : undefined,
        history: rawContext.history,
        markets: rawContext.markets ? { list: rawContext.markets } : undefined,
        rates: rawContext.rates ? { list: rawContext.rates } : undefined,
      };

      return {
        context,
        endpoints,
      };
    },
  };
}
