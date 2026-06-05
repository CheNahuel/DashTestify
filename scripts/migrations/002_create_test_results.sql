-- Create test_results table
create table if not exists public.test_results (
  id uuid not null default gen_random_uuid (),
  run_id uuid null,
  test_name text null,
  suite text null,
  status text null,
  duration_ms bigint null,
  error_message text null,
  browser text null,
  retry bigint null,
  metadata jsonb null,
  constraint test_results_pkey primary key (id),
  constraint test_results_run_id_fkey foreign key (run_id) references test_runs (id) on update cascade on delete cascade
) TABLESPACE pg_default;

-- Create indices for test_results
create index if not exists test_results_run_id_idx on public.test_results(run_id);
create index if not exists test_results_status_idx on public.test_results(status);
create index if not exists test_results_test_name_idx on public.test_results(test_name);
create index if not exists test_results_suite_idx on public.test_results(suite);
