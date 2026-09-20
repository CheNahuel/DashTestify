# Crypto AI Analyst

The Crypto AI Analyst is a floating market assistant built into the dashboard.
It is rendered in Live mode and stays fixed while the dashboard scrolls.

## Using the assistant

1. Start the app with `npm run dev`.
2. Open the dashboard at `http://localhost:3000`.
3. Ensure the dashboard is using Live mode.
4. Select an available provider in the assistant header.
5. Open the fixed Sparkles launcher and submit a market question.

The panel preserves its conversation while it is closed and reopened during the
same browser session. It supports suggested questions and manually typed queries.
Successful responses refresh suggestions from the defaults and exclude the most
recently successful exact question. Failed requests preserve the current list;
Dismiss restores the full default list.

## Providers

The assistant supports:

- Claude
- OpenAI
- Gemini
- Groq
- DeepSeek
- OpenRouter

Provider credentials are read on the server. The provider selector sorts
configured providers first, leaves unconfigured providers visible, and disables
providers without a corresponding API key. Configure one or more keys in `.env`:

```bash
CLAUDE_API_KEY=your_key
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

## Data flow

```text
User question
  -> CryptoAIAnalyst component
  -> POST /api/crypto-ai-analyst
  -> configured crypto data provider
  -> src/lib/ai/crypto-analyst.ts
  -> selected AI provider
  -> Markdown answer with source endpoints
```

The API uses the configured `DATA_SOURCE` value (`supabase` or `coincap`) to
select the primary market data provider. If the primary market provider fails,
the API attempts the mock provider as a fallback. The response includes the
endpoints used to build the supplied market context.

```bash
DATA_SOURCE=supabase
COINCAP_API_KEY=your_api_key
```

The analyzer must use only the supplied crypto context. Its system instructions
require concise chat-sized responses, prohibit Markdown tables, prefer short
paragraphs and numbered/bulleted lists, and distinguish current data from
historical data.

## Implementation

| Area                      | Location                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| Floating chat UI          | `src/features/crypto/components/CryptoAIAnalyst/CryptoAIAnalyst.tsx` |
| Message types             | `src/features/crypto/components/CryptoAIAnalyst/types.ts`            |
| Analyst API route         | `src/app/api/crypto-ai-analyst/route.ts`                             |
| Provider/status endpoint  | `src/app/api/ai-providers-status/route.ts`                           |
| Prompt and provider calls | `src/lib/ai/crypto-analyst.ts`                                       |
| Crypto data providers     | `src/services/crypto/`                                               |

## Tests

The mocked Playwright suite covers the floating assistant in
`tests/e2e/dashboard/crypto-ai-analyst.spec.ts`, including:

- Fixed launcher positioning while scrolling
- Compact empty state and expanded conversation state
- Manual and suggested question success flows
- Failed requests and Dismiss restoration
- Conversation persistence after closing and reopening

Provider response parsing and analyzer integration tests are in
`tests/e2e/ai/crypto-analyst.spec.ts`.

Run the focused tests with:

```bash
npm run test:e2e -- tests/e2e/dashboard/crypto-ai-analyst.spec.ts
npm run test:e2e -- tests/e2e/ai/crypto-analyst.spec.ts
```
