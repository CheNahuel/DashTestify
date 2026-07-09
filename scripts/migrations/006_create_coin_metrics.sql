-- Create coin_metrics table for pre-calculated metrics
create table if not exists public.coin_metrics (
  id uuid not null default gen_random_uuid (),
  coin_id uuid not null unique,
  current_price numeric(20, 8) null,
  ytd_return numeric(10, 4) null,
  return_1m numeric(10, 4) null,
  return_3m numeric(10, 4) null,
  return_6m numeric(10, 4) null,
  return_1y numeric(10, 4) null,
  ath numeric(20, 8) null,
  ath_date date null,
  drawdown numeric(10, 4) null,
  ema20 numeric(20, 8) null,
  ema50 numeric(20, 8) null,
  ema200 numeric(20, 8) null,
  rsi14 numeric(10, 4) null,
  volatility numeric(10, 4) null,
  market_cap numeric(20, 2) null,
  volume24h numeric(20, 2) null,
  updated_at timestamp with time zone not null default now(),
  constraint coin_metrics_pkey primary key (id),
  constraint coin_metrics_coin_id_fkey foreign key (coin_id) references coins (id) on update cascade on delete cascade
) TABLESPACE pg_default;

-- Create indices for common queries
create index if not exists coin_metrics_coin_id_idx on public.coin_metrics(coin_id);
create index if not exists coin_metrics_updated_at_idx on public.coin_metrics(updated_at desc);

-- Enable RLS
alter table public.coin_metrics enable row level security;

-- Allow public read access
create policy "Allow public read access to coin_metrics"
  on public.coin_metrics
  for select
  using (true);

-- Allow service role to insert/update/delete
create policy "Allow service role to manage coin_metrics"
  on public.coin_metrics
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
