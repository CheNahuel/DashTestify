-- Create coins table for tracking supported cryptocurrencies
create table if not exists public.coins (
  id uuid not null default gen_random_uuid (),
  symbol text not null unique,
  name text not null,
  coingecko_id text null,
  coincap_id text not null unique,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coins_pkey primary key (id)
) TABLESPACE pg_default;

-- Create indices for common queries
create index if not exists coins_symbol_idx on public.coins(symbol);
create index if not exists coins_coincap_id_idx on public.coins(coincap_id);
create index if not exists coins_coingecko_id_idx on public.coins(coingecko_id);

-- Enable RLS
alter table public.coins enable row level security;

-- Allow public read access
create policy "Allow public read access to coins"
  on public.coins
  for select
  using (true);

-- Allow service role to insert/update/delete
create policy "Allow service role to manage coins"
  on public.coins
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
