-- Grant public read access to crypto tables
-- These grants enable the RLS "public read" policies defined in migrations 003-006 to work for anon/authenticated roles
-- Run this migration once against your Supabase project to allow public reads of historical price and metrics data

grant select on public.coins to anon, authenticated;
grant select on public.price_daily to anon, authenticated;
grant select on public.price_intraday to anon, authenticated;
grant select on public.coin_metrics to anon, authenticated;
