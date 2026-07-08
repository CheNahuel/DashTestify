# CoinCap Data Service

A centralized, provider-agnostic data service for CoinCap API integration with built-in caching, request deduplication, and intent detection.

## Architecture

```
┌─────────────────────────────────────────┐
│     Dashboard / AI Analyst / Any App    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │  CoinCapClient │  ◄── Main entry point
         └────────┬───────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  cache.ts   intent-     assets.ts
              detector.ts history.ts
      │           │           │
      └───────────┼───────────┘
                  ▼
          ┌──────────────────┐
          │ apiClient (auth) │
          └────────┬─────────┘
                   ▼
            CoinCap API v3
```

## Core Components

### 1. Cache (`cache.ts`)

**Features:**
- Automatic TTL-based expiration per endpoint type
- Request deduplication (multiple callers await same Promise)
- Pattern-based cache clearing

**TTLs:**
```
/assets        → 5 minutes
/markets       → 5 minutes  
/rates         → 30 minutes
/history       → 1 hour
Individual coins → 2 minutes
```

**Usage:**
```typescript
const data = await coincapCache.getOrFetch('assets', async () => {
  return apiClient.get('/assets');
});
```

### 2. Intent Detector (`intent-detector.ts`)

**Features:**
- Analyzes user queries to determine required endpoints
- Extracts coin identifiers from natural language
- Minimizes unnecessary API calls

**Example:**
```typescript
const intent = detectIntent("Compare Bitcoin and Ethereum over 6 months");
// Returns: { needsAssets: false, needsHistory: true, targetCoinIds: ['bitcoin', 'ethereum'], ... }
```

### 3. Client (`client.ts`)

**Main API:**
```typescript
// Fetch specific endpoints
await coincapClient.fetchAssets()
await coincapClient.fetchRates()
await coincapClient.fetchMarkets()
await coincapClient.fetchCoinHistory(coinId, interval)

// Smart fetching based on query intent
await coincapClient.fetchMarketDataForQuery(userQuery)

// Cache management
coincapClient.clearCache()  // Clear all
coincapClient.clearCache('history:*')  // Clear pattern
```

### 4. Domain Modules

#### Assets (`assets.ts`)
- Fetches and transforms coin data
- Maps CoinCap format → Dashboard format
- Used by Dashboard for top coins list

#### History (`history.ts`)
- Fetches price history for coins
- Transforms raw data to [timestamp, price] tuples
- Used by both Dashboard and AI Analyst

## Usage Examples

### Dashboard (Simple Case)
```typescript
// Dashboard loads top coins once, UI reuses the data
const coins = await fetchCoins();  // Cached for 5 minutes
```

### AI Analyst (Smart Intent Detection)
```typescript
// Request "Compare Bitcoin and Ethereum price history"
const { context, endpoints } = await coincapClient.fetchMarketDataForQuery(query);

// Automatically determines:
// - needsAssets: false (not relevant)
// - needsHistory: true (prices over time)
// - targetCoinIds: ['bitcoin', 'ethereum']
// Makes only 2 HTTP requests (BTC + ETH history)
```

### Multiple Concurrent Requests (Deduplication)
```typescript
// 5 components request assets simultaneously
const p1 = fetchAssets();
const p2 = fetchAssets();
const p3 = fetchAssets();
const p4 = fetchAssets();
const p5 = fetchAssets();

// Result: Only 1 HTTP request made
// All 5 promises resolve with same data
const [r1, r2, r3, r4, r5] = await Promise.all([p1, p2, p3, p4, p5]);
```

## Rate Limit Optimization

### Before (Multiple Separate Calls)
```
User: "Compare Bitcoin and Ethereum"

Dashboard:
  GET /assets (for top coins) → Cache miss
  
AI Analyst:  
  GET /assets (again) → Cache miss
  GET /assets/bitcoin/history
  GET /assets/ethereum/history
  GET /rates
  GET /markets
  
Total: 6 requests in 10 seconds
→ EXCEEDS free tier limit (5/min)
```

### After (Shared Cache + Intent Detection)
```
User: "Compare Bitcoin and Ethereum"

Dashboard:
  GET /assets → Cache miss → Cached for 5min
  
AI Analyst:
  Assets already cached → Reuse
  GET /assets/bitcoin/history → Cache miss → Cached for 1hr
  GET /assets/ethereum/history → Cache miss → Cached for 1hr
  Rates/Markets not needed (intent: compare prices)
  
Total: 3 requests in 10 seconds
→ Well within free tier limit
```

## Graceful Degradation

If CoinCap returns 429 (rate limit):

1. Check if cached data exists → Use it with warning
2. No cache available → Return error (user can retry)

Error message:
> "CoinCap rate limit reached. Using the latest cached market snapshot."

## Extending for Other Providers

To add a new provider (e.g., CoinGecko):

1. Create `src/services/coingecko/` with same structure
2. Create adapters to map provider formats to shared ContextData
3. Update consumers to use a provider-agnostic interface
4. No changes needed to Dashboard or AI Analyst code

## Migration Guide

### For Dashboard Code
Replace direct API calls:
```typescript
// OLD
const response = await apiClient.get('/assets');

// NEW
const coins = await fetchCoins();
```

### For AI Analyst
Replace coincap-provider logic:
```typescript
// OLD: Made separate endpoint-specific calls
const { context, endpoints } = await coincapProvider.fetchMarketData(query);

// NEW: Automatic intent detection + deduplication
// No code change needed - provider already refactored
```

### For Server-Side Functions
Already refactored in:
- `getCoinsFromCoinCap.ts` → uses centralized service
- `getCoinHistoryFromCoinCap.ts` → uses centralized service
