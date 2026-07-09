-- Create price_intraday table for recent/intraday price updates
create table if not exists public.price_intraday (
  id uuid not null default gen_random_uuid (),
  coin_id uuid not null,
  timestamp timestamp with time zone not null,
  price numeric(20, 8) not null,
  market_cap numeric(20, 2) null,
  volume_24h numeric(20, 2) null,
  change_24h numeric(10, 4) null,
  created_at timestamp with time zone not null default now(),
  constraint price_intraday_pkey primary key (id),
  constraint price_intraday_coin_id_fkey foreign key (coin_id) references coins (id) on update cascade on delete cascade
) TABLESPACE pg_default;

-- Create indices for common queries
create index if not exists price_intraday_coin_id_idx on public.price_intraday(coin_id);
create index if not exists price_intraday_timestamp_idx on public.price_intraday(timestamp desc);
create index if not exists price_intraday_coin_timestamp_idx on public.price_intraday(coin_id, timestamp desc);

-- Enable RLS
alter table public.price_intraday enable row level security;

-- Allow public read access
create policy "Allow public read access to price_intraday"
  on public.price_intraday
  for select
  using (true);

-- Allow service role to insert/update/delete
create policy "Allow service role to manage price_intraday"
  on public.price_intraday
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
