import { NextResponse } from 'next/server';
import { parseAiProviderName } from '@/lib/ai/index';
import { analyzeCryptoQuery } from '@/lib/ai/crypto-analyst';
import { createCoinCapProvider } from '@/features/crypto/lib/coincap-provider';

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

    // Fetch market data from CoinCap using the dedicated provider
    const coincapProvider = createCoinCapProvider();
    const { context, endpoints } = await coincapProvider.fetchMarketData(body.query);

    if (Object.keys(context).length === 0) {
      return NextResponse.json(
        { error: 'Could not fetch market data from CoinCap. The API may be experiencing issues. Please try again in a moment.' },
        { status: 503 }
      );
    }

    if (endpoints.length === 0) {
      console.warn('No CoinCap endpoints were successfully fetched for query:', body.query);
      return NextResponse.json(
        { error: 'Unable to retrieve market data for your query. Please try a different question or try again later.' },
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
