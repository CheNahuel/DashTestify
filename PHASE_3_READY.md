# 🚀 Fase 3 Lista para Ejecutar

**Tu proyecto:** `kayzrduiqcxvwwjftttk` (Supabase)

---

## ✅ Qué ya está hecho

### Fase 1: Base de datos ✅
- [x] 5 migraciones SQL (003-007) creadas y ejecutadas en Supabase
- [x] Tablas: `coins`, `price_daily`, `price_intraday`, `coin_metrics`
- [x] Índices y RLS configurados
- [x] pg_cron configuration lista

### Fase 2: LLM integration ✅
- [x] Nuevo provider Supabase (`supabase-provider.ts`)
- [x] Route `/api/crypto-ai-analyst` actualizada
- [x] System prompt del LLM mejorado
- [x] Tests Playwright creados

---

## 📋 Qué falta (Fase 3 - ~30 minutos)

| # | Tarea | Dificultad | Tiempo |
|---|-------|-----------|--------|
| 1 | Deploy Edge Functions (`sync-daily`, `sync-intraday`) | 🟢 Fácil | 5 min |
| 2 | Set environment variables en Edge Functions | 🟢 Fácil | 2 min |
| 3 | Configure pg_cron secret en Supabase | 🟢 Fácil | 2 min |
| 4 | Initialize coins (BTC, ETH, etc.) | 🟢 Fácil | 3 min |
| 5 | Run initial data sync | 🟢 Fácil | 5 min |
| 6 | Verify data in database | 🟢 Fácil | 3 min |
| 7 | Test LLM endpoint | 🟢 Fácil | 3 min |
| 8 | Verify cron jobs running | 🟢 Fácil | 2 min |

**Total estimado:** ~25 minutos

---

## 🎯 Quick Start (30 segundo overview)

```bash
# 1. Deploy Edge Functions
supabase functions deploy sync-daily
supabase functions deploy sync-intraday

# 2. Set secrets
supabase secrets set NEXT_PUBLIC_URL="https://tudominio.com" INTERNAL_SYNC_SECRET="tu-secreto"

# 3. Setup pg_cron secret (in Supabase Dashboard SQL Editor)
ALTER DATABASE "kayzrduiqcxvwwjftttk" SET "app.internal_sync_secret" = 'tu-secreto';

# 4. Initialize coins
export SUPABASE_URL="https://kayzrduiqcxvwwjftttk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-key"
npx ts-node scripts/init-crypto-coins.ts

# 5. Run sync
curl -X POST http://localhost:3000/api/internal/sync-intraday \
  -H "Authorization: Bearer tu-secreto"

# 6. Test LLM
curl -X POST http://localhost:3000/api/crypto-ai-analyst \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Bitcoin price?"}'
```

---

## 📂 Archivos clave para Fase 3

```
supabase/functions/
├── sync-daily/index.ts          ← Deploy esto
└── sync-intraday/index.ts       ← Y esto

scripts/migrations/
├── 003_create_coins.sql
├── 004_create_price_daily.sql
├── 005_create_price_intraday.sql
├── 006_create_coin_metrics.sql
├── 007_setup_pg_cron.sql        ← Ya tiene tu PROJECT_ID
├── init-crypto-coins.ts         ← Ejecuta esto
└── setup-crypto-sync.ts         ← Helper para setup

PHASE_3_DEPLOYMENT.md            ← Instrucciones detalladas (¡léelo!)
```

---

## 🔑 Tu configuración

```
Project ID:        kayzrduiqcxvwwjftttk
Supabase URL:      https://kayzrduiqcxvwwjftttk.supabase.co
Edge Functions:    https://kayzrduiqcxvwwjftttk.supabase.co/functions/v1/

Cron jobs:
  sync-daily:      Diario @ 1 AM UTC
  sync-intraday:   Cada 5 minutos
```

---

## 📊 Resultado final (después de Fase 3)

```
ANTES:
  User → "What is Bitcoin price?"
       → /api/crypto-ai-analyst
       → coincapClient.fetchMarketDataForQuery()
       → CoinCap API (LIVE)
       → 429 Rate Limit ❌
       → Error response

DESPUÉS:
  User → "What is Bitcoin price?"
       → /api/crypto-ai-analyst
       → repositories.getCoinMetrics()
       → Supabase (READ)
       → price_intraday + coin_metrics tables
       → Response in < 500ms ✅
       → Zero rate limits ✅
       → Persistent data ✅
```

---

## 🎬 Empecemos

Lee [PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md) para instrucciones detalladas paso a paso.

**TL;DR:**
1. Deploy Edge Functions desde Supabase Dashboard
2. Set env vars (`NEXT_PUBLIC_URL`, `INTERNAL_SYNC_SECRET`)
3. Execute `ALTER DATABASE...` SQL en Supabase
4. Run `npm ts-node scripts/init-crypto-coins.ts`
5. Trigger initial sync via curl/script
6. Verify data appeared in Supabase
7. Test `/api/crypto-ai-analyst` responds with Supabase data
8. Done! ✨

---

## ❓ Preguntas que podrías tener

**P: ¿Por qué necesito NEXT_PUBLIC_URL en Edge Functions?**
R: Porque las Edge Functions necesitan llamar a tus API routes (`/api/internal/sync-*`) para ejecutar la lógica real.

**P: ¿Cuánto tiempo toma la sincronización inicial?**
R: Depende del histórico descargado. ~5-30 minutos típicamente. El archivo `syncInitial.ts` descarga toda la historia de CoinCap.

**P: ¿Qué pasa si un cron job falla?**
R: Supabase registra el error en `cron.job_run_details`. Puedes ver logs de Edge Functions en Dashboard.

**P: ¿Puedo agregar más monedas después?**
R: Sí. Solo inserta en la tabla `coins` y corre `syncInitial` para esa moneda. Los cron jobs ya la sincronizarán.

**P: ¿Cómo verifico que no hay más rate limits?**
R: Después de Fase 3, revisa tu CoinCap dashboard. CoinCap API calls deberían bajar de 100+/hora a 1-2/min.

---

## 🚀 Status

```
Fase 1: Database architecture    ✅ COMPLETA
Fase 2: LLM integration          ✅ COMPLETA
Fase 3: Deployment               ⏳ LISTO PARA EMPEZAR

Total commits:                   6
Total files created:             30+
Total lines of code:             5000+
```

---

**¿Listo? Lee [PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md) y sigue los pasos. ¡Vamos!** 🚀
