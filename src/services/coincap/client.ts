import { apiClient } from '@/lib/api-client';
import { coincapCache } from './cache';
import { detectIntent, extractCoinIds } from './intent-detector';

export interface ContextData {
  assets?: unknown[];
  history?: Record<string, unknown[]>;
  markets?: unknown[];
  rates?: unknown[];
}

export interface FetchResult {
  context: ContextData;
  endpoints: string[];
}

class CoinCapClient {
  async fetchAssets(): Promise<unknown[]> {
    return coincapCache.getOrFetch('assets', async () => {
      const response = await apiClient.get<{ data: unknown[] }>('/assets', {
        params: { limit: 50 },
      });
      return response.data.data;
    });
  }

  async fetchRates(): Promise<unknown[]> {
    return coincapCache.getOrFetch('rates', async () => {
      const response = await apiClient.get<{ data: unknown[] }>('/rates', {
        params: { limit: 5 },
      });
      return response.data.data;
    });
  }

  async fetchMarkets(): Promise<unknown[]> {
    return coincapCache.getOrFetch('markets', async () => {
      const response = await apiClient.get<{ data: unknown[] }>('/exchanges', {
        params: { limit: 20 },
      });
      return response.data.data;
    });
  }

  async fetchCoinHistory(
    coinId: string,
    interval: string = 'd1',
    limit: number = 365
  ): Promise<unknown[]> {
    const key = `history:${coinId}:${interval}`;
    return coincapCache.getOrFetch(key, async () => {
      const response = await apiClient.get<{ data: unknown[] }>(
        `/assets/${coinId}/history`,
        {
          params: { interval, limit },
        }
      );
      return response.data.data;
    });
  }

  async fetchMarketDataForQuery(userQuery: string): Promise<FetchResult> {
    const intent = detectIntent(userQuery);
    const context: ContextData = {};
    const endpointsUsed: Set<string> = new Set();

    console.log(
      `[CoinCap] Detected intent: ${intent.reason} (coins: ${intent.targetCoinIds.join(', ')})`
    );

    try {
      if (intent.needsAssets) {
        try {
          context.assets = await this.fetchAssets();
          endpointsUsed.add('/assets');
          console.log('✓ Fetched assets from CoinCap');
        } catch (error) {
          console.warn('Failed to fetch assets:', error);
        }
      }

      if (intent.needsHistory && intent.targetCoinIds.length > 0) {
        context.history = {};
        for (const coinId of intent.targetCoinIds) {
          try {
            const histData = await this.fetchCoinHistory(coinId, 'd1', 365);
            context.history[coinId] = histData;
            endpointsUsed.add(`/assets/${coinId}/history`);
            console.log(`✓ Fetched history for ${coinId}`);
          } catch (error) {
            console.warn(`Failed to fetch history for ${coinId}:`, error);
          }
        }
      }

      if (intent.needsMarkets) {
        try {
          context.markets = await this.fetchMarkets();
          endpointsUsed.add('/exchanges');
          console.log('✓ Fetched market data from CoinCap');
        } catch (error) {
          console.warn('Failed to fetch markets:', error);
        }
      }

      if (intent.needsRates) {
        try {
          context.rates = await this.fetchRates();
          endpointsUsed.add('/rates');
          console.log('✓ Fetched exchange rates from CoinCap');
        } catch (error) {
          console.warn('Failed to fetch rates:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching CoinCap data:', error);
    }

    console.log(
      `Successfully fetched ${endpointsUsed.size} endpoints for query: "${userQuery}"`
    );

    return {
      context,
      endpoints: Array.from(endpointsUsed),
    };
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      coincapCache.clearPattern(pattern);
    } else {
      coincapCache.clear();
    }
  }
}

export const coincapClient = new CoinCapClient();
