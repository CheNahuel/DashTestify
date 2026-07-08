import Anthropic from '@anthropic-ai/sdk';
import type { AiProviderName } from '../../../scripts/ai/types';

export interface CryptoAnalysisRequest {
  query: string;
  context: Record<string, unknown>;
  endpoints: string[];
}

export interface CryptoAnalysisResponse {
  answer: string;
  sources: string[];
  provider: AiProviderName;
}

function buildCryptoSystemPrompt(context: Record<string, unknown>): string {
  return `You are a senior cryptocurrency analyst with deep expertise in blockchain markets.

Your role is to answer questions about cryptocurrency using ONLY the provided CoinCap market data.

CRITICAL RULES:
1. Never invent prices, trends, or market information
2. Only use data from the CoinCap API context provided
3. If required information is unavailable, clearly state it
4. Be concise and data-driven
5. Use markdown formatting for clarity (headers, bullet points, tables when appropriate)

Available CoinCap Data:
${JSON.stringify(context, null, 2)}

When answering, consider:
- Market trends and volatility
- Price comparisons and performance metrics
- Asset rankings by market cap or volume
- Historical price movements
- Exchange activity and markets

Provide your analysis concisely in a clear, structured format.`;
}

export async function analyzeCryptoQuery(
  request: CryptoAnalysisRequest,
  providerName: AiProviderName
): Promise<CryptoAnalysisResponse> {
  // Use Claude directly for crypto analysis
  // (expandable to support other providers in the future)
  if (providerName !== 'claude') {
    console.warn(`Crypto analysis currently only supports Claude provider, falling back from ${providerName}`);
  }

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY is required for crypto analysis');
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

  const systemPrompt = buildCryptoSystemPrompt(request.context);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: request.query,
      },
    ],
  });

  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n')
    .trim();

  return {
    answer: answer || 'Unable to generate analysis',
    sources: request.endpoints,
    provider: 'claude',
  };
}
