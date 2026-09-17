import { NextResponse } from 'next/server';
import { parseAiProviderName } from '@/lib/ai/index';
import { analyzeCryptoQuery } from '@/lib/ai/crypto-analyst';
import { getCryptoDataProvider, getDataSource, createMockProvider } from '@/services/crypto';

export const runtime = 'nodejs';

type CryptoAiRequestBody = {
  query: string;
  provider?: string;
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

    // Use configured data source (controlled by DATA_SOURCE env var)
    const dataSource = getDataSource();
    const dataProvider = getCryptoDataProvider();
    console.log(`[crypto-analyst] Using data source: ${dataSource} for query: "${body.query}"`);

    let context: Record<string, unknown> = {};
    let endpoints: string[] = [];
    let lastError: Error | null = null;

    // Try to fetch with configured provider
    try {
      const result = await dataProvider.fetchMarketData(body.query);
      context = result.context;
      endpoints = result.endpoints;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[crypto-analyst] ${dataSource} failed:`, lastError.message);

      // Fallback to mock provider if primary fails
      console.log('[crypto-analyst] Attempting fallback to mock data...');
      try {
        const mockProvider = createMockProvider();
        const result = await mockProvider.fetchMarketData(body.query);
        context = result.context;
        endpoints = result.endpoints;
        console.log('[crypto-analyst] Successfully fell back to mock data');
        lastError = null;
      } catch (fallbackError) {
        lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        console.warn('[crypto-analyst] Mock provider also failed:', lastError.message);
      }
    }

    // If we couldn't get data from any source, return error
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
            dataSource === 'supabase' ? 'Please ensure coins are synced to Supabase.' : 'The API may be experiencing issues.'
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
