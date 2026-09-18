-- Create price_daily table for daily OHLC data
create table if not exists public.price_daily (
  id uuid not null default gen_random_uuid (),
  coin_id uuid not null,
  date date not null,
  open numeric(20, 8) not null,
  high numeric(20, 8) not null,
  low numeric(20, 8) not null,
  close numeric(20, 8) not null,
  volume numeric(20, 2) null,
  market_cap numeric(20, 2) null,
  created_at timestamp with time zone not null default now(),
  constraint price_daily_pkey primary key (id),
  constraint price_daily_coin_id_fkey foreign key (coin_id) references coins (id) on update cascade on delete cascade,
  constraint price_daily_unique_coin_date unique (coin_id, date)
) TABLESPACE pg_default;

-- Create indices for common queries
create index if not exists price_daily_coin_id_idx on public.price_daily(coin_id);
create index if not exists price_daily_date_idx on public.price_daily(date desc);
create index if not exists price_daily_coin_date_idx on public.price_daily(coin_id, date desc);

-- Enable RLS
alter table public.price_daily enable row level security;

-- Allow public read access
create policy "Allow public read access to price_daily"
  on public.price_daily
  for select
  using (true);

-- Allow service role to insert/update/delete
create policy "Allow service role to manage price_daily"
  on public.price_daily
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
