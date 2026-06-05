# Database Migrations

This directory contains SQL migration scripts for setting up the DashTestify database schema.

## Migration Files

Migrations should be run in order:
1. `001_create_test_runs.sql` - Creates the test_runs table and indices
2. `002_create_test_results.sql` - Creates the test_results table and foreign key relationship

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
