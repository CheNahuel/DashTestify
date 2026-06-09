# Database Setup Guide

DashTestify uses Supabase (PostgreSQL) to store QA Analytics data.

## Prerequisites

- Supabase account and project
- `SUPABASE_URL` and `SUPABASE_KEY` environment variables set in `.env`

## Tables

### test_runs
Stores test execution metadata and results.

**Used by:**
- QA Analytics Local page
- Test trend calculations
- Run history tracking

**Schema:**
```sql
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  commit_sha text,
  branch text,
  total_tests bigint,
  passed bigint,
  failed bigint,
  duration_ms bigint
);
```

### test_results
Stores individual test result details, one row per test per run.

**Used by:**
- Detailed test failure analysis
- AI failure diagnostics
- Test history and flakiness detection
- Performance analysis

**Schema:**
```sql
create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references test_runs(id) on delete cascade,
  test_name text,
  suite text,
  status text,           -- passed, failed, skipped, flaky
  duration_ms bigint,
  error_message text,
  browser text,          -- chromium, firefox, webkit
  retry bigint,          -- 0 for first attempt
  metadata jsonb         -- flexible additional data
);
```

## Setup Instructions

### Option 1: Automatic Setup (Recommended)

```bash
npm run setup:db
```

This runs `scripts/setup-db.ts` which creates the tables and indices.

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **Create new query**
4. Copy the entire contents from `scripts/migrations/001_create_test_runs.sql`
5. Click **Run**

### Option 3: Using Supabase CLI

```bash
supabase db push
```

## Verification

To verify the tables were created successfully:

```bash
# Via Supabase Dashboard
1. Go to Table Editor
2. Verify `test_runs` table exists
3. Check that indices are created (view in SQL Editor)

# Via psql (if you have direct access)
psql -h your-host -U your-user -d your-db -c "\\dt public.*"
```

## Querying the Tables

### Recent Test Runs (Last 30 Days)
```sql
select * from test_runs 
where created_at >= now() - interval '30 days'
order by created_at desc;
```

### Test Runs by Branch
```sql
select branch, count(*) as runs, avg(passed::float/total_tests::float) as pass_rate
from test_runs
where created_at >= now() - interval '30 days'
group by branch
order by pass_rate desc;
```

### Find a Specific Commit's Tests
```sql
select * from test_runs 
where commit_sha = 'abc123...'
order by created_at desc;
```

## Troubleshooting

### "Table already exists" error
This is normal and expected. The migration uses `create table if not exists` to be idempotent.

### "exec_sql RPC not available"
Use the **Manual Setup via Supabase Dashboard** option instead. The automatic setup assumes an RPC function that may not be available in all Supabase projects.

### Permission denied
Make sure your `SUPABASE_KEY` has the appropriate permissions. Use an **anon** or **service_role** key with sufficient permissions.

## Related Files

- `scripts/migrations/001_create_test_runs.sql` - Table creation SQL
- `scripts/setup-db.ts` - Automated setup script
- `src/lib/quality-analytics/` - QA Analytics query functions
