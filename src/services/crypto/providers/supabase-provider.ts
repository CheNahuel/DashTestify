import type { CryptoDataProvider } from '../types';
import type { Coin, CoinHistory, CoinHistoryRequest } from '@/features/crypto/types/coin';
import type { ContextData } from '@/features/crypto/components/CryptoAIAnalyst/types';
import { detectIntent } from '@/services/coincap/intent-detector';
import * as repositories from '@/database/repositories';
import * as queries from '@/database/queries';

const COINCAP_ICON_BASE = 'https://assets.coincap.io/assets/icons';

function mapCoinMetricsToCoins(
  coins: any[],
  metrics: Map<string, any>
): Coin[] {
  return coins.map((coin) => {
    const metric = metrics.get(coin.id);
    return {
      id: coin.coincap_id,
      name: coin.name,
      symbol: coin.symbol,
      current_price: metric?.current_price ?? 0,
      price_change_percentage_24h: metric?.return_1m ?? 0,
      image: `${COINCAP_ICON_BASE}/${coin.symbol.toLowerCase()}@2x.png`,
      market_cap: metric?.market_cap ?? 0,
      total_volume: metric?.volume24h ?? 0,
    };
  });
}

export function createSupabaseProvider(): CryptoDataProvider {
  return {
    async getAssets(): Promise<Coin[]> {
      const coins = await repositories.getAllSupportedCoins();
      const metrics = new Map();

      for (const coin of coins) {
        const metric = await repositories.getCoinMetrics(coin.id);
        if (metric) {
          metrics.set(coin.id, metric);
        }
      }

      return mapCoinMetricsToCoins(coins, metrics);
    },

    async getAsset(id: string): Promise<Coin | null> {
      const coin = await queries.getCoinByCoincapId(id);
      if (!coin) {
        return null;
      }

      const metric = await repositories.getCoinMetrics(coin.id);
      const result = mapCoinMetricsToCoins([coin], new Map([[coin.id, metric]]));
      return result[0] || null;
    },

    async getHistory(assetId: string, request: CoinHistoryRequest): Promise<CoinHistory> {
      const coin = await queries.getCoinByCoincapId(assetId);
      if (!coin) {
        return { prices: [] };
      }

      const startDate = new Date(request.start);
      const endDate = new Date(request.end);

      const priceHistory = await queries.getPriceDailyForCoin(coin.id, startDate, endDate);

      const prices = priceHistory.map((p) => [
        new Date(p.date).getTime(),
        parseFloat(p.close),
      ] as [number, number]);

      return { prices };
    },

    async fetchMarketData(userQuery: string): Promise<{ context: ContextData; endpoints: string[] }> {
      const intent = detectIntent(userQuery);
      const endpoints: string[] = [];
      const context: ContextData = {};

      try {
        const allCoins = await repositories.getAllSupportedCoins();
        if (allCoins.length === 0) {
          throw new Error('No coins are currently available in the database');
        }

        const targetCoins = [];
        for (const coincapId of intent.targetCoinIds) {
          const coin = await queries.getCoinByCoincapId(coincapId);
          if (coin) {
            targetCoins.push(coin);
          }
        }

        if (intent.needsAssets || targetCoins.length > 0) {
          endpoints.push('/assets');
          const coinsToFetch = targetCoins.length > 0 ? targetCoins : allCoins;

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

        if (intent.needsMarkets || intent.needsAssets) {
          const topMovers = await repositories.getTopMovers(10, 'ytd');
          context.markets = {
            topMoversYTD: topMovers,
          };
        }

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
