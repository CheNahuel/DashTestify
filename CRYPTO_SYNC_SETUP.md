# Crypto Data Sync Setup Guide

This guide explains how to set up the crypto data synchronization infrastructure in Supabase.

## Architecture Overview

```
CoinCap API
    ↓
Supabase Edge Functions + pg_cron
    ↓
Internal Next.js API Routes (/api/internal/sync-*)
    ↓
Supabase Database (coins, price_daily, price_intraday, coin_metrics)
    ↓
LLM / Analytics (read-only)
```

**Key principle**: The LLM never calls CoinCap directly. All data flows through Supabase.

## Setup Steps

### 1. Create Database Schema

Run the migrations in order:

```bash
# Via Supabase CLI
supabase db push

# Or manually via Supabase Dashboard:
# SQL Editor → Create New Query → Paste each migration file content
```

Migrations to run:
- `scripts/migrations/003_create_coins.sql`
- `scripts/migrations/004_create_price_daily.sql`
- `scripts/migrations/005_create_price_intraday.sql`
- `scripts/migrations/006_create_coin_metrics.sql`

### 2. Configure Environment Variables

Add to your `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INTERNAL_SYNC_SECRET=generate-a-random-secret-here
```

The `INTERNAL_SYNC_SECRET` must be a secure random string (e.g., use `openssl rand -base64 32`).

### 3. Deploy Edge Functions

```bash
# Deploy to Supabase
supabase functions deploy sync-daily
supabase functions deploy sync-intraday

# Set environment variables for Edge Functions
supabase secrets set NEXT_PUBLIC_URL=https://your-domain.com INTERNAL_SYNC_SECRET=your-secret
```

Alternatively, set these in the Supabase Dashboard:
- Project → Functions → Choose function → Settings → Environment Variables

### 4. Initialize Coins

Before scheduling jobs, populate the `coins` table. You can:

**Option A: Use the API endpoint (if you create one)**

```typescript
import { syncInitialBatch } from "@/sync/syncInitial";

await syncInitialBatch([
  { symbol: "BTC", name: "Bitcoin", coincapId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coincapId: "ethereum" },
  { symbol: "BNB", name: "Binance Coin", coincapId: "binance-coin" },
  // ... more coins
]);
```

**Option B: Direct SQL in Supabase Dashboard**

```sql
INSERT INTO public.coins (symbol, name, coincap_id)
VALUES
  ('BTC', 'Bitcoin', 'bitcoin'),
  ('ETH', 'Ethereum', 'ethereum'),
  ('BNB', 'Binance Coin', 'binance-coin')
ON CONFLICT (symbol) DO NOTHING;
```

**Option C: Create a one-off endpoint** (temporary)

```typescript
// src/app/api/admin/init-coins/route.ts
import { syncInitialBatch } from "@/sync/syncInitial";

export async function POST(req) {
  const coins = await req.json();
  const result = await syncInitialBatch(coins);
  return Response.json(result);
}
```

Then call it once, then delete the endpoint.

### 5. Configure pg_cron (Scheduled Jobs)

Run migration 007:

```bash
supabase db push
```

**Important**: Before running, edit `007_setup_pg_cron.sql`:
- Replace `PROJECT_ID` with your actual Supabase project ID
- Ensure `app.internal_sync_secret` is set in Supabase project settings

To set `app.internal_sync_secret`, run in Supabase SQL Editor:

```sql
ALTER DATABASE "PROJECT_ID" SET "app.internal_sync_secret" = 'your-sync-secret';
```

Or modify the migration to hardcode the secret:

```sql
'Bearer your-sync-secret' 
-- instead of
'Bearer ' || current_setting('app.internal_sync_secret')
```

### 6. Verify Setup

1. **Check if tables were created:**

```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('coins', 'price_daily', 'price_intraday', 'coin_metrics');
```

2. **Check if coins were inserted:**

```sql
SELECT * FROM public.coins;
```

3. **Check if cron jobs are scheduled:**

```sql
SELECT * FROM cron.job;
```

4. **Manually trigger a sync to test:**

```bash
curl -X POST http://localhost:3000/api/internal/sync-intraday \
  -H "Authorization: Bearer your-sync-secret" \
  -H "Content-Type: application/json" \
  -d '{}'
```

5. **Check if data was inserted:**

```sql
SELECT * FROM public.price_intraday ORDER BY created_at DESC LIMIT 10;
```

## Testing

### Test Initial Sync

```typescript
import { syncInitialForCoin } from "@/sync/syncInitial";

// In a test or one-off endpoint:
await syncInitialForCoin({
  symbol: "BTC",
  name: "Bitcoin",
  coincapId: "bitcoin",
});
```

### Test Daily Sync

```bash
curl -X POST http://localhost:3000/api/internal/sync-daily \
  -H "Authorization: Bearer $INTERNAL_SYNC_SECRET"
```

### Test Intraday Sync

```bash
curl -X POST http://localhost:3000/api/internal/sync-intraday \
  -H "Authorization: Bearer $INTERNAL_SYNC_SECRET"
```

## Monitoring

### Check Sync Logs

Via Supabase Dashboard:
- Project → Logs → Edge Functions (for Edge Function logs)
- Project → SQL Editor → `SELECT * FROM postgres_logs` (for cron logs)

### Monitor Table Growth

```sql
-- Count records by table
SELECT 'coins' as table_name, COUNT(*) as count FROM public.coins
UNION ALL
SELECT 'price_daily', COUNT(*) FROM public.price_daily
UNION ALL
SELECT 'price_intraday', COUNT(*) FROM public.price_intraday
UNION ALL
SELECT 'coin_metrics', COUNT(*) FROM public.coin_metrics;

-- Check freshness
SELECT 
  'price_daily' as source,
  MAX(date) as last_updated
FROM public.price_daily
UNION ALL
SELECT 
  'price_intraday',
  MAX(DATE(timestamp)) as last_updated
FROM public.price_intraday;
```

### Monitor CoinCap API Usage

After setup, CoinCap API calls should come ONLY from:
- `/api/internal/sync-daily` (once per day)
- `/api/internal/sync-intraday` (every 5 minutes)
- `/api/services/marketData.ts` → `refreshLatestPrice()` (only if price data is > 5 min old)

Check your CoinCap API logs to confirm you're hitting the rate limit less often (or not at all, if most queries are historical).

## Troubleshooting

### pg_cron jobs not running

**Check if pg_cron extension is enabled:**

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

If not:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**Check if jobs are in the queue:**

```sql
SELECT * FROM cron.job WHERE jobname LIKE 'sync-crypto%';
```

**Check cron logs:**

```sql
SELECT * FROM cron.job_run_details 
WHERE job_id = (SELECT jobid FROM cron.job WHERE jobname = 'sync-crypto-daily')
ORDER BY end_time DESC
LIMIT 10;
```

### Edge Function not connecting

**Check Edge Function logs:**
- Supabase Dashboard → Functions → Choose function → Logs

**Verify NEXT_PUBLIC_URL is correct:**
- The Edge Function must be able to reach your Next.js app over HTTP
- In production, use your actual domain (not localhost)
- In development, use `http://localhost:3000` if running locally

### Sync Secret mismatches

Ensure the secret in:
- `.env.local` (INTERNAL_SYNC_SECRET)
- Edge Function settings (INTERNAL_SYNC_SECRET)
- pg_cron SQL (if hardcoded)

...are all identical.

### Data not syncing

1. Check if coins table has data
2. Check Edge Function logs
3. Verify NEXT_PUBLIC_URL is reachable
4. Manually test the API endpoint with curl
5. Check Supabase service role key is correct

## Cleanup / Removal

To remove all crypto data and revert to the previous state:

```sql
-- Unschedule cron jobs
SELECT cron.unschedule('sync-crypto-daily');
SELECT cron.unschedule('sync-crypto-intraday');

-- Delete tables (this will cascade delete all data)
DROP TABLE IF EXISTS public.coin_metrics;
DROP TABLE IF EXISTS public.price_intraday;
DROP TABLE IF EXISTS public.price_daily;
DROP TABLE IF EXISTS public.coins;
```

Then delete the Edge Functions from the Supabase Dashboard.

## Next Steps

1. Once sync is working, modify `src/app/api/crypto-ai-analyst/route.ts` to use `src/database/repositories.ts` instead of calling CoinCap directly.
2. Add tests for the sync logic and repositories.
3. Monitor CoinCap API usage to confirm you're hitting rate limits much less frequently (or not at all).
