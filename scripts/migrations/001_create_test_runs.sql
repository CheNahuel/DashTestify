-- Create test_runs table for QA Analytics
create table if not exists public.test_runs (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  commit_sha text null,
  branch text null,
  total_tests bigint null,
  passed bigint null,
  failed bigint null,
  duration_ms bigint null,
  constraint test_runs_pkey primary key (id)
) TABLESPACE pg_default;

-- Create indices for common queries
create index if not exists test_runs_branch_created_at_idx on public.test_runs(branch, created_at desc);
create index if not exists test_runs_created_at_idx on public.test_runs(created_at desc);
create index if not exists test_runs_commit_sha_idx on public.test_runs(commit_sha);
