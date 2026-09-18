# Crypto Data Sync Scripts

Complete guide to syncing crypto market data to Supabase.

## Quick Start

```bash
# 1. Initialize coins in the database
npx tsx scripts/init-crypto-coins.ts

# 2. Sync historical data (~1 year per coin)
npx tsx scripts/sync-historical-data.ts
```

That's it! Your database will be populated with historical OHLC data and metrics.

## Environment Setup

Both scripts require these environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add them to your `.env` file or export them in your shell.

## Script Details

### `init-crypto-coins.ts`
**Purpose:** Initialize cryptocurrency coins in the database

**What it does:**
- Creates or updates coins in the `coins` table
- Sets up coin metadata (name, CoinCap ID, CoinGecko ID)
- Initializes 10 default coins (BTC, ETH, SOL, BNB, ADA, XRP, DOGE, LINK, USDT, USDC)

**Usage:**
```bash
npx tsx scripts/init-crypto-coins.ts
```

**Output:**
```
✅ Inserted/updated 10 coins:
   BTC    - Bitcoin
   ETH    - Ethereum
   ...
✨ Coins initialized successfully!
```

**Troubleshooting:**
- **Missing env vars:** Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- **Database error:** Check that Supabase service role key is valid
- **Already exists:** Script uses `upsert`, so re-running is safe

### `sync-historical-data.ts`
**Purpose:** Sync ~1 year of historical OHLC data and calculate metrics

**What it does:**
1. **Fetches data** from CoinGecko (primary) with CoinCap fallback
2. **Inserts prices** into `price_daily` table in batches
3. **Calculates metrics** (ATH, drawdown, YTD return, EMA, RSI, volatility, etc.)
4. **Updates** `coin_metrics` table with calculated values

**Strategy:**
- **CoinGecko** (primary source): No rate limits, reliable, 365-day history
- **CoinCap** (fallback): Used if CoinGecko fails, 5 req/min free tier
- **Batch processing**: Inserts 50 candles at a time for efficiency
- **Gradual processing**: 1 second delay between coins to be respectful to APIs

**Usage:**
```bash
npx tsx scripts/sync-historical-data.ts
```

**Expected Output:**
```
═════════════════════════════════════════════════════════════
🚀 Historical Crypto Data Sync
═════════════════════════════════════════════════════════════
📍 Supabase: https://...
📊 Coins: 10
⏱️  Strategy: CoinGecko (primary) → CoinCap (fallback)

🔄 BTC    Syncing...
  📡 Fetching from CoinGecko...
  ✓ Got 365 daily candles
  💾 Inserting to Supabase...
  Progress: 365/365
  ✓ Metrics updated
✅ BTC complete (365 candles)

... (8 more coins) ...

═════════════════════════════════════════════════════════════
📈 SYNC RESULTS
═════════════════════════════════════════════════════════════
  ✅ BTC    365 candles — Synced successfully
  ✅ ETH    365 candles — Synced successfully
  ... (8 more) ...
Result: 10/10 coins synced successfully

✨ All coins synced successfully!
```

**Duration:** ~2-3 minutes total (no rate limiting issues)

### Troubleshooting

#### "Network error" or "fetch failed"
- Check your internet connection
- Verify firewall allows outbound HTTPS to `api.coingecko.com` and `api.coincap.io`
- Try again in a moment (temporary network blip)

#### "HTTP 404" for a specific coin
- The coin ID is wrong
- Check the `COINS` array in `sync-historical-data.ts`
- Verify against CoinGecko's API: `https://api.coingecko.com/api/v3/coins/{id}`
- Example valid IDs: `bitcoin`, `ethereum`, `binancecoin`, `usd-coin`

#### "Rate limited" (HTTP 429)
- This shouldn't happen with the default script (CoinGecko has no rate limit)
- If it does: wait 60+ seconds and try again
- Check for other sync scripts running simultaneously
- Never run multiple sync scripts at the same time

#### "Database error" or "Column X does not exist"
- Ensure database migrations have run
- Run: `npx tsx scripts/migrations/` or `npm run db:migrate`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is valid and hasn't expired

#### "Coin not found"
- Coins must be initialized first
- Run: `npx tsx scripts/init-crypto-coins.ts`
- Verify coin was created: Check `coins` table in Supabase

### Manual Coin Addition

To add a custom coin to the sync:

1. Add entry to `COINS` array in `sync-historical-data.ts`:
```typescript
{ symbol: "CUSTOM", name: "Custom Coin", coincapId: "custom-coin", coingeckoId: "custom-coin" }
```

2. Find correct IDs:
   - **CoinGecko ID**: Check https://api.coingecko.com/api/v3/coins/list
   - **CoinCap ID**: Check https://api.coincap.io/v2/assets

3. Run sync script

### Re-syncing Data

The scripts are safe to re-run:

```bash
# Safe to run multiple times
npx tsx scripts/init-crypto-coins.ts  # Uses upsert, won't duplicate
npx tsx scripts/sync-historical-data.ts  # Skips coins with 200+ days of data
```

To force a complete re-sync:

```sql
-- Delete all price data
DELETE FROM price_daily;

-- Delete all metrics
DELETE FROM coin_metrics;

-- Then run sync script again
```

### Performance Notes

- **Time:** ~2-3 minutes for 10 coins (1 year history each)
- **Data:** ~3,650+ daily OHLC candles + metrics
- **Network:** ~100 API calls total
- **Bandwidth:** ~5-10 MB

### API Limits

For reference if you modify the scripts:

| Source | Limit | Strategy |
|--------|-------|----------|
| CoinGecko | Unlimited (free tier) | Use as primary |
| CoinCap | 5 req/min (free tier) | Use as fallback only |

### Adding a Daily Sync

To update data daily, create a scheduled job:

```typescript
// Example: Daily sync at 2 AM UTC
import cron from 'node-cron';
import { syncHistoricalData } from './sync-historical-data';

cron.schedule('0 2 * * *', async () => {
  console.log('Running daily data sync...');
  await syncHistoricalData();
});
```

Or use Supabase's scheduled functions / edge functions.

---

**Questions?** Check the error messages in the script output — they're designed to guide you to the solution.
