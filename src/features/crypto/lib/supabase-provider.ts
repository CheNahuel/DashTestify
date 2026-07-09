import type { ContextData } from '../components/CryptoAIAnalyst/types';
import { detectIntent } from '@/services/coincap/intent-detector';
import * as repositories from '@/database/repositories';
import * as queries from '@/database/queries';

export interface SupabaseProvider {
  fetchMarketData(query: string): Promise<{ context: ContextData; endpoints: string[] }>;
}

export function createSupabaseProvider(): SupabaseProvider {
  return {
    async fetchMarketData(userQuery: string) {
      const intent = detectIntent(userQuery);
      const endpoints: string[] = [];
      const context: ContextData = {};

      try {
        // Get all supported coins first
        const allCoins = await repositories.getAllSupportedCoins();
        if (allCoins.length === 0) {
          throw new Error('No coins are currently available in the database');
        }

        // Map coincap IDs from intent to actual coins
        const targetCoins = [];
        for (const coincapId of intent.targetCoinIds) {
          const coin = await queries.getCoinByCoincapId(coincapId);
          if (coin) {
            targetCoins.push(coin);
          }
        }

        const targetSymbols = targetCoins.map((c) => c.symbol);

        // Fetch assets if needed (current prices and metrics)
        if (intent.needsAssets || targetCoins.length > 0) {
          endpoints.push('/assets');
          const coinsToFetch = targetCoins.length > 0 ? targetCoins : allCoins;

          // Get metrics for these coins
          const metrics = await Promise.all(
            coinsToFetch.map((coin) => repositories.getCoinMetrics(coin.id))
          );

          context.assets = {
            list: coinsToFetch.map((coin, i) => {
              const metric = metrics[i];
              return {
                id: coin.coincap_id,
                symbol: coin.symbol,
                name: coin.name,
                priceUsd: metric?.current_price?.toString() || '0',
                marketCapUsd: metric?.market_cap?.toString() || '0',
                volumeUsd24Hr: metric?.volume24h?.toString() || '0',
                changePercent24Hr: (metric?.return_1m ?? 0).toString(),
                supply: null,
                maxSupply: null,
                rank: null,
                vwap24Hr: null,
              };
            }),
          };
        }

        // Fetch price history if needed
        if (intent.needsHistory && targetCoins.length > 0) {
          endpoints.push('/assets/{id}/history');
          const historicalData: Record<string, unknown> = {};

          for (const coin of targetCoins) {
            const history = await repositories.getCoinHistory(coin.id);
            if (history) {
              historicalData[coin.coincap_id] = {
                symbol: coin.symbol,
                name: coin.name,
                metrics: history.metrics,
                priceHistory: history.priceHistory.map((p) => ({
                  date: p.date,
                  open: p.open,
                  high: p.high,
                  low: p.low,
                  close: p.close,
                  volume: p.volume,
                  marketCap: p.market_cap,
                })),
              };
            }
          }

          context.history = historicalData;
        }

        // Top movers for market data
        if (intent.needsMarkets || intent.needsAssets) {
          const topMovers = await repositories.getTopMovers(10, 'ytd');
          context.markets = {
            topMoversYTD: topMovers,
          };
        }

        // If no specific context was built, return general metrics for all coins
        if (Object.keys(context).length === 0 && allCoins.length > 0) {
          endpoints.push('/assets');
          const metrics = await Promise.all(
            allCoins.map((coin) => repositories.getCoinMetrics(coin.id))
          );

          context.assets = {
            list: allCoins.map((coin, i) => {
              const metric = metrics[i];
              return {
                id: coin.coincap_id,
                symbol: coin.symbol,
                name: coin.name,
                priceUsd: metric?.current_price?.toString() || '0',
                marketCapUsd: metric?.market_cap?.toString() || '0',
                volumeUsd24Hr: metric?.volume24h?.toString() || '0',
                changePercent24Hr: (metric?.return_1m ?? 0).toString(),
              };
            }),
          };
        }

        return {
          context,
          endpoints,
        };
      } catch (error) {
        console.error('Supabase provider error:', error);
        throw error;
      }
    },
  };
}
