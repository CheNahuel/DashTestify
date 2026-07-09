# Database Migrations

This directory contains SQL migration scripts for setting up the DashTestify database schema.

## Migration Files

Migrations should be run in order:
1. `001_create_test_runs.sql` - Creates the test_runs table and indices
2. `002_create_test_results.sql` - Creates the test_results table and foreign key relationship
3. `003_create_coins.sql` - Creates the coins table for tracking cryptocurrencies
4. `004_create_price_daily.sql` - Creates the price_daily table for OHLC data
5. `005_create_price_intraday.sql` - Creates the price_intraday table for recent prices
6. `006_create_coin_metrics.sql` - Creates the coin_metrics table for pre-calculated metrics
7. `007_setup_pg_cron.sql` - Enables pg_cron and schedules daily/intraday sync jobs

## Tables

### test_runs
Stores test execution results and metadata.

**Fields:**
- `id` (UUID, PK): Unique identifier for each test run
- `created_at` (Timestamp): When the test run was executed
- `commit_sha` (Text): Git commit SHA associated with the run
- `branch` (Text): Git branch where tests were run
- `total_tests` (BigInt): Total number of tests executed
- `passed` (BigInt): Number of passed tests
- `failed` (BigInt): Number of failed tests
- `duration_ms` (BigInt): How long the test run took in milliseconds

### test_results
Stores individual test results for each test run. Linked to test_runs via foreign key.

**Fields:**
- `id` (UUID, PK): Unique identifier for each test result
- `run_id` (UUID, FK): Reference to parent test_runs record
- `test_name` (Text): Name of the test
- `suite` (Text): Test suite name (e.g., dashboard/search.spec.ts)
- `status` (Text): Test status - passed, failed, skipped, flaky
- `duration_ms` (BigInt): How long this individual test took
- `error_message` (Text): Error message if test failed
- `browser` (Text): Browser used for the test (chromium, firefox, webkit)
- `retry` (BigInt): Retry attempt number (0 = first attempt)
- `metadata` (JSONB): Additional test metadata (flexible schema)

## Running Migrations

### With Supabase CLI
```bash
supabase db push
```

### With psql (direct SQL)
```bash
psql -h your-host -U your-user -d your-db -f 001_create_test_runs.sql
```

### Via Supabase Dashboard
1. Go to SQL Editor
2. Create new query
3. Copy the contents of the migration file
4. Execute

## Indices

### test_runs Indices
- `test_runs_branch_created_at_idx`: Optimizes filtering by branch and sorting by date
- `test_runs_created_at_idx`: Optimizes recent test queries
- `test_runs_commit_sha_idx`: Optimizes lookup by commit SHA

### test_results Indices
- `test_results_run_id_idx`: Optimizes queries filtering by test run
- `test_results_status_idx`: Optimizes filtering by test status
- `test_results_test_name_idx`: Optimizes lookups by test name
- `test_results_suite_idx`: Optimizes filtering by test suite

## Crypto Tables

### coins
Stores supported cryptocurrencies metadata.

**Fields:**
- `id` (UUID, PK): Unique identifier
- `symbol` (Text, UNIQUE): Ticker symbol (e.g., BTC, ETH)
- `name` (Text): Full name (e.g., Bitcoin)
- `coingecko_id` (Text, nullable): CoinGecko ID for lookups
- `coincap_id` (Text, UNIQUE): CoinCap ID for API calls
- `created_at` (Timestamp): When the coin was added
- `updated_at` (Timestamp): When metadata was last updated

**Indices:**
- `coins_symbol_idx`: Optimizes lookups by symbol
- `coins_coincap_id_idx`: Optimizes lookups by CoinCap ID
- `coins_coingecko_id_idx`: Optimizes lookups by CoinGecko ID

### price_daily
Stores daily OHLC (Open, High, Low, Close) candles.

**Fields:**
- `id` (UUID, PK): Unique identifier
- `coin_id` (UUID, FK): Reference to coins
- `date` (Date): The date of the candle
- `open` (Numeric): Opening price
- `high` (Numeric): Highest price
- `low` (Numeric): Lowest price
- `close` (Numeric): Closing price
- `volume` (Numeric, nullable): Trading volume
- `market_cap` (Numeric, nullable): Market capitalization
- `created_at` (Timestamp): When data was inserted

**Unique Constraint:**
- `price_daily_unique_coin_date`: One candle per coin per day

**Indices:**
- `price_daily_coin_id_idx`: Optimizes lookups by coin
- `price_daily_date_idx`: Optimizes date range queries
- `price_daily_coin_date_idx`: Optimizes coin + date queries

### price_intraday
Stores recent/intraday price snapshots (updated every 5 minutes).

**Fields:**
- `id` (UUID, PK): Unique identifier
- `coin_id` (UUID, FK): Reference to coins
- `timestamp` (Timestamp): When the price was recorded
- `price` (Numeric): Current price
- `market_cap` (Numeric, nullable): Market capitalization
- `volume_24h` (Numeric, nullable): 24-hour trading volume
- `change_24h` (Numeric, nullable): 24-hour percentage change
- `created_at` (Timestamp): When data was inserted

**Indices:**
- `price_intraday_coin_id_idx`: Optimizes lookups by coin
- `price_intraday_timestamp_idx`: Optimizes recent queries
- `price_intraday_coin_timestamp_idx`: Optimizes coin + timestamp queries

### coin_metrics
Stores pre-calculated metrics to avoid repeated computation.

**Fields:**
- `id` (UUID, PK): Unique identifier
- `coin_id` (UUID, FK, UNIQUE): Reference to coins (one row per coin)
- `current_price` (Numeric): Latest price
- `ytd_return` (Numeric): Year-to-date return %
- `return_1m` (Numeric): 1-month return %
- `return_3m` (Numeric): 3-month return %
- `return_6m` (Numeric): 6-month return %
- `return_1y` (Numeric): 1-year return %
- `ath` (Numeric): All-time high price
- `ath_date` (Date): Date of ATH
- `drawdown` (Numeric): Maximum drawdown %
- `ema20` (Numeric): 20-day exponential moving average
- `ema50` (Numeric): 50-day exponential moving average
- `ema200` (Numeric): 200-day exponential moving average
- `rsi14` (Numeric): 14-period relative strength index
- `volatility` (Numeric): Price volatility %
- `market_cap` (Numeric): Current market cap
- `volume24h` (Numeric): 24-hour trading volume
- `updated_at` (Timestamp): Last update time

**Indices:**
- `coin_metrics_coin_id_idx`: Optimizes lookups by coin
- `coin_metrics_updated_at_idx`: Optimizes freshness checks

## Row Level Security (RLS)

All crypto tables have RLS enabled:
- **Public read access**: Authenticated and anonymous users can read all records
- **Service role write access**: Only the service role can insert/update/delete

This prevents the frontend (using anon key) from modifying data, while backend cron jobs (using service role key) can maintain the data.

## Scheduled Jobs Setup (Migration 007)

Migration 007 configures `pg_cron` to schedule recurring sync jobs. Before running this migration:

1. Replace `PROJECT_ID` in the migration with your actual Supabase project ID (found in your Supabase URL)
2. Ensure `app.internal_sync_secret` is set in your Supabase project settings, or modify the SQL to use a hardcoded secret
3. Ensure Edge Functions `sync-daily` and `sync-intraday` are deployed to your Supabase project

You can verify scheduled jobs with:
```sql
SELECT * FROM cron.job;
```

To remove a job:
```sql
SELECT cron.unschedule('sync-crypto-daily');
SELECT cron.unschedule('sync-crypto-intraday');
```
