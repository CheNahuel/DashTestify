# Crypto AI Analyst - Implementation Guide

## Status: Foundation Complete ✅

This document outlines the foundation implementation of the Crypto AI Analyst feature, with guidance on completing the integration and extension.

---

## What's Been Implemented

### 1. **Type System** ✅
- Location: `src/features/crypto/components/CryptoAIAnalyst/types.ts`
- Defines: `CryptoChatMessage`, `AIAnalystResponse`, `ContextData`
- Supports: All CoinCap endpoints

### 2. **Context Builder** ✅
- Location: `src/features/crypto/lib/context-builder.ts`
- Features:
  - Analyzes user queries to determine needed CoinCap endpoints
  - Extracts coin names from queries (Bitcoin, Ethereum, Solana, etc.)
  - Fetches only relevant market data
  - Returns endpoints used (for citations)
  - Error handling for failed fetches

### 3. **API Route** ✅
- Location: `src/app/api/crypto-ai-analyst/route.ts`
- Features:
  - POST endpoint for AI queries
  - Accepts query and provider selection
  - Builds context from CoinCap data
  - Reuses existing AI provider factory
  - Error handling and logging

### 4. **UI Component** ✅
- Location: `src/features/crypto/components/CryptoAIAnalyst/CryptoAIAnalyst.tsx`
- Features:
  - Chat interface with message history
  - Input box with send button
  - Loading state with animated dots
  - Error display
  - Provider selector (OpenAI, Claude, Gemini, Groq, DeepSeek, OpenRouter)
  - Suggested questions (4 displayed, 10 total)
  - Source citations in message footer
  - Auto-scroll to latest message
  - Responsive design (mobile to desktop)

---

## What Still Needs Implementation

### 1. **API Route Completion** 🔴 CRITICAL

The API route (`src/app/api/crypto-ai-analyst/route.ts`) is incomplete. Currently it:
- ✅ Builds context from CoinCap data
- ✅ Creates AI provider
- ❌ Does NOT call the AI provider

**Problem:** The existing `FailureAnalyzer` interface only supports `analyzeFailure()` method.

**Solution Needed:**
You need to extend the AI provider abstraction to support general queries. Two approaches:

#### Option A: Extend Existing Providers
Modify each provider (OpenAI, Claude, Gemini, etc.) to add a `queryMarketData()` method:

```typescript
// In scripts/ai/openai-provider.ts
export type OpenAiProvider = FailureAnalyzer & {
  queryMarketData(systemPrompt: string, userQuery: string): Promise<string>;
};
```

Then update the factory to support this method.

#### Option B: Create Generic Query Method
Add a generic `query()` method to the `FailureAnalyzer` interface:

```typescript
// In scripts/ai/types.ts
export type FailureAnalyzer = {
  provider: AiProviderName;
  analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis>;
  queryMarketData?(systemPrompt: string, userQuery: string): Promise<string>;
};
```

**Recommended:** Option B (less intrusive)

### 2. **AI Provider Calls**

Once the providers support market data queries, update the API route:

```typescript
// In src/app/api/crypto-ai-analyst/route.ts
const answer = await aiProvider.queryMarketData(systemPrompt, userMessage);

return Response.json({
  answer,
  sources: endpoints,
});
```

### 3. **Dashboard Integration**

Add the component to the Dashboard below Market Overview:

```typescript
// In src/app/components/Dashboard.tsx
import { CryptoAIAnalyst } from '@/features/crypto/components/CryptoAIAnalyst';

// In the return JSX, below the existing components:
{!useMock && isLiveAvailable && (
  <div className="grid gap-4 sm:gap-6">
    <CryptoAIAnalyst />
  </div>
)}
```

### 4. **Response Formatting**

The API route should format responses nicely. Add a formatter:

```typescript
// src/features/crypto/lib/format-market-answer.ts
export function formatMarketAnswer(answer: string): string {
  // Apply markdown formatting rules
  // Ensure consistent styling with dashboard
  return answer;
}
```

### 5. **Error Handling & Validation**

Ensure robust error handling:
- ✅ CoinCap fetch failures
- ❌ AI provider failures
- ❌ Rate limiting
- ❌ Token limit exceeded
- ❌ Invalid queries

### 6. **Suggested Questions Enhancement**

Currently shows static list. Consider:
- Dynamic suggestions based on current market data
- User's chat history
- Time of day / market activity

---

## Integration Steps

### Step 1: Extend AI Providers
Choose Option B above and extend all 6 providers:
- `openai-provider.ts`
- `claude-provider.ts`
- `gemini-provider.ts`
- `groq-provider.ts`
- `deepseek-provider.ts`
- `openrouter-provider.ts`

### Step 2: Update API Route
Implement the `queryMarketData()` call in the API route.

### Step 3: Add to Dashboard
Import and render the component conditionally on Live Mode.

### Step 4: Test

```bash
# Test the component in Live Mode
npm run dev

# Navigate to home page
# Verify component appears only when Live Mode is enabled
# Test with different providers
# Test error scenarios
```

### Step 5: Add E2E Tests
```bash
# tests/e2e/crypto-ai-analyst.spec.ts
test('should show AI analyst in live mode', async ({ page }) => {
  // Visit dashboard
  // Verify component appears
  // Send a query
  // Verify response appears
});
```

---

## Architecture Details

### Data Flow

```
User Query
  ↓
CryptoAIAnalyst Component (UI)
  ↓
POST /api/crypto-ai-analyst
  ↓
buildContextFromQuery()
  ├─ Fetch /assets
  ├─ Fetch /assets/{id}/history
  ├─ Fetch /markets
  └─ Fetch /rates
  ↓
AI Provider.queryMarketData()
  ├─ OpenAI API
  ├─ Claude API
  ├─ Gemini API
  ├─ Groq API
  ├─ DeepSeek API
  └─ OpenRouter API
  ↓
Format Response
  ↓
Return { answer, sources }
  ↓
Render in Chat UI
```

### Context Building Logic

The `buildContextFromQuery()` function analyzes user input to determine needed data:
- Keywords: "compare", "trend", "history", "gainers", "losers", etc.
- Coin extraction: Bitcoin, Ethereum, Solana, XRP, etc.
- Intelligent data fetching: Only requests needed endpoints

### Security

- ✅ No API keys exposed in client code
- ✅ All CoinCap calls server-side
- ✅ AI provider keys in environment
- ✅ No hardcoded data
- ✅ Query validation needed

---

## Testing Checklist

- [ ] Component renders in Live Mode
- [ ] Component hidden in Mock Mode
- [ ] Chat sends messages
- [ ] Responses appear with sources
- [ ] Suggested questions populate input
- [ ] Provider selector works
- [ ] Error states display
- [ ] Loading state appears
- [ ] All 6 AI providers work
- [ ] Responsive on mobile
- [ ] Auto-scroll works
- [ ] No console errors

---

## Future Enhancements

### Phase 2: Follow-up Questions
- Preserve conversation context
- Track message history in context
- Support multi-turn conversations

### Phase 3: Streaming Responses
- Stream tokens as they arrive
- Provider support check
- UI updates for streaming

### Phase 4: Advanced Features
- Technical indicators (RSI, MACD)
- Portfolio analysis
- Price alerts with AI explanations
- Market sentiment analysis
- News integration
- Fear & Greed Index

---

## Configuration

### Environment Variables Needed
```bash
# For each AI provider (already configured)
OPENAI_API_KEY=...
CLAUDE_API_KEY=...
GEMINI_API_KEY=...
GROQ_API_KEY=...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=...

# Optional: Default provider
AI_ANALYST_PROVIDER=openai

# Optional: Model overrides
OPENAI_MODEL=gpt-4
CLAUDE_MODEL=claude-3-sonnet
```

---

## Performance Considerations

- CoinCap API requests: ~500ms - 1s per query
- AI Provider calls: 2-10s depending on provider
- Total latency: ~3-12s per query
- Caching: Consider caching CoinCap data (1-5 min)

---

## Known Limitations

1. **Static Coin Mapping:** Hardcoded coin names → CoinCap IDs. Should query `/assets` for auto-mapping.
2. **No Conversation Memory:** Each query is independent. Future: Store in Supabase.
3. **Basic Prompt:** System prompt could be more sophisticated with examples and constraints.
4. **No Rate Limiting:** Should add rate limiting per user/IP.
5. **Limited Error Context:** API errors not detailed for user debugging.

---

## Files Created

```
src/features/crypto/components/CryptoAIAnalyst/
├── CryptoAIAnalyst.tsx    ✅ Main component
├── types.ts               ✅ Type definitions
└── index.ts               ✅ Exports

src/features/crypto/lib/
└── context-builder.ts     ✅ CoinCap context fetching

src/app/api/crypto-ai-analyst/
└── route.ts               ✅ API endpoint (incomplete)
```

---

## Next Steps

1. **Extend AI Providers** (Required)
   - Add `queryMarketData()` method
   - Implement in all 6 providers
   - Test each provider

2. **Complete API Route** (Required)
   - Call AI provider
   - Format response
   - Error handling

3. **Integrate into Dashboard** (Required)
   - Import component
   - Conditional rendering
   - Styling alignment

4. **Test & Verify** (Required)
   - E2E tests
   - All providers working
   - Error scenarios

5. **Deployment** (Optional)
   - Monitor performance
   - Track API costs
   - Gather user feedback

---

## Support & Debugging

### Component Not Appearing?
- Check `isLiveAvailable={true}` in Dashboard props
- Verify `COINCAP_API_KEY` is set
- Check `useMock={false}`

### AI Provider Failing?
- Verify API key is set
- Check provider logs
- Verify model name is correct

### CoinCap Fetch Failing?
- Check CoinCap API status
- Verify query parameters
- Check network errors

---

**Status: Ready for Provider Extension** 🚀
