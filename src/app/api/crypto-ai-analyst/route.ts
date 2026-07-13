import { NextResponse } from 'next/server';
import { parseAiProviderName } from '@/lib/ai/index';
import { analyzeCryptoQuery } from '@/lib/ai/crypto-analyst';
import { createSupabaseProvider } from '@/features/crypto/lib/supabase-provider';
import { createCoinCapProvider } from '@/features/crypto/lib/coincap-provider';

export const runtime = 'nodejs';

type CryptoAiRequestBody = {
  query: string;
  provider?: string;
  useSupabase?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as CryptoAiRequestBody | null;

    if (!body?.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Parse provider name (defaults to claude for crypto analysis)
    const provider = parseAiProviderName(body.provider || 'claude');

    // Prefer Supabase (if available), fallback to CoinCap
    const useSupabase = body.useSupabase !== false && process.env.USE_SUPABASE_CRYPTO !== 'false';
    let dataProvider;
    let dataSource: string;

    if (useSupabase) {
      try {
        dataProvider = createSupabaseProvider();
        dataSource = 'Supabase';
        console.log('[crypto-analyst] Using Supabase data source');
      } catch (error) {
        console.warn('[crypto-analyst] Supabase provider failed, falling back to CoinCap:', error);
        dataProvider = createCoinCapProvider();
        dataSource = 'CoinCap (fallback)';
      }
    } else {
      dataProvider = createCoinCapProvider();
      dataSource = 'CoinCap';
    }

    console.log(`[crypto-analyst] Using data source: ${dataSource} for query: "${body.query}"`);

    let context: Record<string, unknown> = {};
    let endpoints: string[] = [];
    let lastError: Error | null = null;

    // Try to fetch with selected provider
    try {
      const result = await dataProvider.fetchMarketData(body.query);
      context = result.context;
      endpoints = result.endpoints;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[crypto-analyst] ${dataSource} failed:`, lastError.message);

      // If we tried Supabase and it failed, fallback to CoinCap
      if (useSupabase && dataSource !== 'CoinCap') {
        console.log('[crypto-analyst] Attempting fallback to CoinCap...');
        try {
          const fallbackProvider = createCoinCapProvider();
          const result = await fallbackProvider.fetchMarketData(body.query);
          context = result.context;
          endpoints = result.endpoints;
          dataSource = 'CoinCap (fallback after Supabase error)';
          lastError = null;
        } catch (fallbackError) {
          lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        }
      }
    }

    // If we couldn't get data from either source, return error
    if (lastError && (!context || Object.keys(context).length === 0)) {
      return NextResponse.json(
        {
          error: `Could not fetch market data. ${lastError.message}`,
        },
        { status: 503 }
      );
    }

    if (Object.keys(context).length === 0) {
      return NextResponse.json(
        {
          error: `Could not fetch market data from ${dataSource}. ${
            useSupabase ? 'Please ensure coins are synced to Supabase.' : 'The API may be experiencing issues.'
          } Please try again in a moment.`,
        },
        { status: 503 }
      );
    }

    if (endpoints.length === 0) {
      console.warn(`No ${dataSource} endpoints were successfully fetched for query:`, body.query);
      return NextResponse.json(
        {
          error: `Unable to retrieve market data from ${dataSource} for your query. Please try a different question or try again later.`,
        },
        { status: 503 }
      );
    }

    // Use the dedicated crypto analyzer
    const analysis = await analyzeCryptoQuery(
      {
        query: body.query,
        context,
        endpoints,
      },
      provider
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Crypto AI analyst error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze market query' },
      { status: 500 }
    );
  }
}
