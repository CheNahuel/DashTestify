import type { ContextData } from '../components/CryptoAIAnalyst/types';
import { coincapClient } from '@/services/coincap';

export interface CoinCapProvider {
  fetchMarketData(query: string): Promise<{ context: ContextData; endpoints: string[] }>;
}

export function createCoinCapProvider(): CoinCapProvider {
  return {
    async fetchMarketData(userQuery: string) {
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
