import type { Coin } from '@/features/crypto/types/coin';
import type { CoinHistory, CoinHistoryRequest } from '@/features/crypto/types/coin';
import type { ContextData } from '@/features/crypto/components/CryptoAIAnalyst/types';

export type DataSource = 'coincap' | 'supabase';

export interface CryptoDataProvider {
  getAssets(): Promise<Coin[]>;
  getAsset(id: string): Promise<Coin | null>;
  getHistory(assetId: string, request: CoinHistoryRequest): Promise<CoinHistory>;
  fetchMarketData(query: string): Promise<{ context: ContextData; endpoints: string[] }>;
}

export function isValidDataSource(value: unknown): value is DataSource {
  return value === 'coincap' || value === 'supabase';
}
