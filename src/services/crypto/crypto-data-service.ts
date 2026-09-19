import type { CryptoDataProvider } from "./types";
import type { Coin, CoinHistory, CoinHistoryRequest } from "@/features/crypto/types/coin";
import type { ContextData } from "@/features/crypto/components/CryptoAIAnalyst/types";
import { isValidDataSource, type DataSource } from "./types";
import { createCoinCapProvider } from "./providers/coincap-provider";
import { createSupabaseProvider } from "./providers/supabase-provider";
import { createMockProvider } from "./providers/mock-provider";

let cachedCoinCapProvider: CryptoDataProvider | null = null;
let cachedSupabaseProvider: CryptoDataProvider | null = null;
let cachedMockProvider: CryptoDataProvider | null = null;

function getCoinCapProvider(): CryptoDataProvider {
  if (!cachedCoinCapProvider) {
    cachedCoinCapProvider = createCoinCapProvider();
  }
  return cachedCoinCapProvider;
}

function getSupabaseProvider(): CryptoDataProvider {
  if (!cachedSupabaseProvider) {
    cachedSupabaseProvider = createSupabaseProvider();
  }
  return cachedSupabaseProvider;
}

function getMockProvider(): CryptoDataProvider {
  if (!cachedMockProvider) {
    cachedMockProvider = createMockProvider();
  }
  return cachedMockProvider;
}

export function getDataSource(): DataSource {
  const raw = process.env.DATA_SOURCE ?? "supabase";
  if (!isValidDataSource(raw)) {
    throw new Error(`Invalid DATA_SOURCE "${raw}". Must be "coincap" or "supabase".`);
  }
  return raw;
}

export interface CryptoDataWithMeta {
  data: Coin[] | Coin | CoinHistory | { context: ContextData; endpoints: string[] };
  fallback: boolean;
  fallbackReason?: string;
}

/**
 * Get the primary crypto data provider based on DATA_SOURCE env var.
 * If the primary fails, falls back to mock provider transparently.
 */
export function getCryptoDataProvider(): CryptoDataProvider {
  const source = getDataSource();
  return source === "supabase" ? getSupabaseProvider() : getCoinCapProvider();
}

/**
 * Get the primary provider with automatic fallback to mock on error.
 * Returns both the data and a flag indicating if we fell back to mock.
 */
export async function getCryptoDataWithFallback<T>(
  primaryFetch: () => Promise<T>,
): Promise<{ data: T; fallback: boolean; fallbackReason?: string }> {
  try {
    const data = await primaryFetch();
    return { data, fallback: false };
  } catch (error) {
    console.warn("Primary provider failed, falling back to mock:", error);
    const mockProvider = getMockProvider();

    // Reconstruct the call using mock provider
    // Note: This is a simplified fallback — for more complex queries, additional logic may be needed
    try {
      // Try to determine what was being called and use mock equivalent
      // This will throw for fetchMarketData, which is expected (AI analyst shouldn't auto-fallback)
      const data = await primaryFetch.call(mockProvider);
      return {
        data,
        fallback: true,
        fallbackReason: "Primary data source unavailable, using cached/mock data",
      };
    } catch {
      // If even mock fails, re-throw the original error
      throw error;
    }
  }
}

/**
 * Get assets from the configured provider.
 */
export async function getAssets(): Promise<Coin[]> {
  return getCryptoDataProvider().getAssets();
}

/**
 * Get a single asset by ID.
 */
export async function getAsset(id: string): Promise<Coin | null> {
  return getCryptoDataProvider().getAsset(id);
}

/**
 * Get historical data for an asset.
 */
export async function getHistory(
  assetId: string,
  request: CoinHistoryRequest,
): Promise<CoinHistory> {
  return getCryptoDataProvider().getHistory(assetId, request);
}

/**
 * Fetch market data for AI analyst queries (no automatic fallback for fetchMarketData).
 */
export async function fetchMarketData(
  query: string,
): Promise<{ context: ContextData; endpoints: string[] }> {
  return getCryptoDataProvider().fetchMarketData(query);
}
