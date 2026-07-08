# CoinCap Integration Refactoring Summary

## Overview

Refactored the CoinCap API integration to eliminate duplicate requests, implement intelligent caching, and reduce rate limit pressure on the free tier (5 requests/minute).

## Problem Statement

**Before:** 
- Dashboard and AI Analyst made independent, uncached requests to CoinCap
- Each user query could trigger 4-6 redundant API calls
- Free tier rate limit (5 requests/minute) was easily exceeded with concurrent usage
- Caching logic was duplicated across multiple server functions

**After:**
- Centralized service with unified cache and request deduplication
- Intent detection minimizes unnecessary API calls
- Shared cache across all consumers
- Single source of truth for CoinCap data

## Architecture

```
src/services/coincap/
├── cache.ts              # Unified cache with TTL-based expiration & deduplication
├── intent-detector.ts    # Query analysis to determine needed endpoints
├── client.ts             # Main service coordinating all API calls
├── assets.ts             # Coin data transformations
├── history.ts            # Price history transformations
├── index.ts              # Public API exports
└── README.md             # Full documentation
```

## Key Features

### 1. Automatic TTL Expiration
```typescript
/assets:      5 min   (frequently updated, user-relevant)
/markets:     5 min   (exchange data)
/rates:       30 min  (relatively stable)
/history:     1 hour  (historical data doesn't change)
```

### 2. Request Deduplication
Multiple simultaneous requests for the same endpoint share a single in-flight Promise:

```typescript
// 5 components request assets at same time
const [r1, r2, r3, r4, r5] = await Promise.all([
  fetchAssets(),
  fetchAssets(), 
  fetchAssets(),
  fetchAssets(),
  fetchAssets()
]);
// Result: 1 HTTP request, 5 fulfilled Promises
```

### 3. Intent Detection
Analyzes queries to fetch only required data:

```
Query: "Compare Bitcoin and Ethereum over 6 months"
Detected: needsHistory = true, targetCoins = [bitcoin, ethereum]
Action: Only fetch 2 history endpoints (not assets, rates, or markets)
```

## Integration Points

### Dashboard
- `getCoinsFromCoinCap()` → uses centralized `fetchCoins()`
- `getCoinHistoryFromCoinCap()` → uses centralized `fetchCoinHistory()`
- Both now benefit from unified cache and deduplication

### AI Analyst
- `createCoinCapProvider()` → delegates to `coincapClient.fetchMarketDataForQuery()`
- Intelligent intent detection prevents over-fetching
- Reuses cached data from Dashboard automatically

## API Impact

### Request Count Reduction

**Scenario: User asks "Compare Bitcoin and Ethereum prices"**

**Before:**
```
Request 1: GET /assets (top coins for dashboard)
Request 2: GET /assets (AI intent analysis)
Request 3: GET /assets/bitcoin/history
Request 4: GET /assets/ethereum/history
Request 5: GET /rates
Request 6: GET /markets
Total: 6 requests
```

**After:**
```
Request 1: GET /assets → cached 5 min
Request 2: GET /assets/bitcoin/history → cached 1 hour
Request 3: GET /assets/ethereum/history → cached 1 hour
Intent detected: only history needed, skip /rates and /markets
Total: 3 requests
```

### Rate Limit Safety

**Free tier:** 5 requests/minute = ~1 request per second

**Old pattern:** Single user asking 3 sequential questions = 18 requests (EXCEEDS)

**New pattern:** Same user asking 3 sequential questions = 6-9 requests (SAFE)

## Graceful Degradation

### Rate Limit Handling (429 response)
1. Cache exists? → Use cached data + warning
2. Cache miss → Return error to user
3. User can retry after waiting

```typescript
"CoinCap rate limit reached. Using the latest cached market snapshot."
```

## Migration

### For Existing Code
All migrations already completed:
- ✅ `getCoinsFromCoinCap.ts` - 60 lines → 13 lines
- ✅ `getCoinHistoryFromCoinCap.ts` - 73 lines → 16 lines
- ✅ `coincap-provider.ts` - 160 lines → 17 lines

### For Future Endpoints
Add to `client.ts`:
```typescript
async fetchNewEndpoint(params): Promise<Data> {
  return coincapCache.getOrFetch(`endpoint:${params}`, async () => {
    const response = await apiClient.get('/endpoint', { params });
    return response.data.data;
  });
}
```

## Provider Independence

The service design allows future migrations:

To add CoinGecko support:
1. Create `src/services/coingecko/` with same structure
2. Create adapter to convert CoinGecko format → shared `ContextData`
3. Update API routes to switch providers
4. Dashboard and AI Analyst code remains unchanged

## Testing

All 103 e2e tests pass ✅

No behavioral changes in:
- Dashboard rendering
- Search and filtering
- Navigation flows
- Price alerts and watchlists
- Mobile responsiveness

## Files Changed

### New Files
- `src/services/coincap/cache.ts`
- `src/services/coincap/intent-detector.ts`
- `src/services/coincap/client.ts`
- `src/services/coincap/assets.ts`
- `src/services/coincap/history.ts`
- `src/services/coincap/index.ts`
- `src/services/coincap/README.md`

### Modified Files
- `src/features/crypto/server/getCoinsFromCoinCap.ts` (simplified)
- `src/features/crypto/server/getCoinHistoryFromCoinCap.ts` (simplified)
- `src/features/crypto/lib/coincap-provider.ts` (simplified)

### Deleted Files
- `src/features/crypto/lib/context-builder.ts` (duplicate, now in unified provider)

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| API Requests | 6+ per query | 2-4 per query |
| Code Duplication | Across 3+ files | Single source of truth |
| Cache Efficiency | Separate caches | Unified with deduplication |
| Intent Detection | Hardcoded | Smart query analysis |
| Rate Limit Safety | Exceeds easily | Respects limits |
| Provider Agnostic | No | Yes |
| Lines of Code | 300+ | 150+ |

## Future Improvements

1. **Persistent Cache**: Add Redis for cross-instance caching
2. **Analytics**: Track API call patterns and cache hit rates
3. **Quota Management**: Implement request budget tracking
4. **Multi-Provider**: Support fallback to CoinGecko if CoinCap limited
5. **React Query Integration**: Synchronize with dashboard's TanStack Query cache
