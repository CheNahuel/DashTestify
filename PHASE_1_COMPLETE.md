# Fase 1 Completa: Arquitectura Supabase para Datos Cripto

## 🎉 Qué se implementó

### 1. Esquema de base de datos (4 nuevas tablas + pg_cron)

| Tabla | Propósito | Actualizaciones |
|-------|-----------|-----------------|
| `coins` | Registro de monedas soportadas | Una sola vez (manual) |
| `price_daily` | Velas OHLC diarias | Diario (cron) |
| `price_intraday` | Precios recientes | Cada 5 minutos (cron) |
| `coin_metrics` | Métricas calculadas (returns, EMA, RSI, etc.) | Diario + cada 5 min |

**Características:**
- RLS habilitado: lectura pública, escritura solo service role
- Índices optimizados para las consultas más comunes
- Foreign keys que limpian cascada
- Constraint UNIQUE en price_daily (coin_id + date)

**Migraciones:**
- `003_create_coins.sql`
- `004_create_price_daily.sql`
- `005_create_price_intraday.sql`
- `006_create_coin_metrics.sql`
- `007_setup_pg_cron.sql` (con cron schedule)

### 2. Capa de servicios (módulos TypeScript reutilizables)

```
src/services/
├── metrics.ts          → Funciones puras de cálculo (no dependen de BD)
│   ├── calculateYTDReturn()
│   ├── calculatePeriodReturn()
│   ├── calculateATH()
│   ├── calculateDrawdown()
│   ├── calculateEMA()
│   ├── calculateRSI()
│   ├── calculateVolatility()
│   └── calculateAllMetrics()
│
└── marketData.ts       → Única función que llama a CoinCap desde aquí
    └── refreshLatestPrice(coinId)  → Solo si datos > 5 min
```

### 3. Capa de base de datos (queries + repositorios)

```
src/database/
├── queries.ts          → Llamadas SQL/PostgREST puras
│   ├── getCoinBySymbol()
│   ├── getCoinById()
│   ├── getPriceDailyForCoin()
│   ├── getCoinMetrics()
│   ├── getLatestPriceIntraday()
│   └── compareCoinsMetrics()
│
└── repositories.ts     → API de alto nivel para LLM/backend
    ├── getCoinHistory()
    ├── getCoinMetrics()
    ├── getLatestPrice()          → Chequea TTL, refresca si es viejo
    ├── compareCoins()
    ├── getTopMovers()
    └── getAllSupportedCoins()
```

### 4. Módulo de sincronización (Phase de datos)

```
src/sync/
├── syncInitial.ts      → Descarga histórico completo (una sola vez por coin)
│   ├── syncInitialForCoin()
│   └── syncInitialBatch()
│
├── syncDaily.ts        → Cron diario: ayer's candle + recalcula métricas
│   ├── syncDaily()
│   └── recalculateAllMetrics()
│
└── syncIntraday.ts     → Cron cada 5 min: precios actuales
    └── syncIntraday()
```

### 5. API Routes internos (protegidos por secret)

```
src/app/api/internal/
├── sync-daily/route.ts      → POST /api/internal/sync-daily
└── sync-intraday/route.ts   → POST /api/internal/sync-intraday
```

Ambos validan header `Authorization: Bearer $INTERNAL_SYNC_SECRET`.

### 6. Supabase Edge Functions (Deno)

```
supabase/functions/
├── sync-daily/          → Deno wrapper que llama a /api/internal/sync-daily
└── sync-intraday/       → Deno wrapper que llama a /api/internal/sync-intraday
```

Estas funciones son disparadas por `pg_cron` dentro de Supabase.

### 7. Configuración

**Nuevas variables de entorno:**
- `SUPABASE_SERVICE_ROLE_KEY` → Para que el cron escriba en BD
- `INTERNAL_SYNC_SECRET` → Para proteger los endpoints /api/internal/sync-*

**Cliente Supabase actualizado:**
- `src/lib/supabase.ts` ahora expone `getSupabaseServiceClient()` además del anon client

### 8. Documentación

- `CRYPTO_SYNC_SETUP.md` → Guía completa de instalación, configuración, monitoreo y troubleshooting
- `scripts/migrations/README.md` → Actualizado con las nuevas tablas y configuración de pg_cron

---

## 📋 Flujo de datos actual vs nuevo

### ANTES (problema)

```
LLM → POST /api/crypto-ai-analyst
       → coincapClient.fetchMarketDataForQuery()
       → CoinCap API (en vivo)
       → 429 Too Many Requests ❌
```

### DESPUÉS (solución)

```
┌─ Supabase Edge Functions (cron)
│  ├─ Cada 5 min: /api/internal/sync-intraday
│  │  → fetchAssets() de CoinCap
│  │  → insert price_intraday + update coin_metrics
│  │
│  └─ Diario @ 1 AM: /api/internal/sync-daily
│     → fetchCoinHistory() de CoinCap (solo ayer)
│     → insert price_daily
│     → recalculate coin_metrics
│
├─ syncInitial (manual, una sola vez)
│  └─ Descarga histórico completo
│     → insert price_daily (todas las fechas históricas)
│     → insert coin_metrics
│
└─ LLM → POST /api/crypto-ai-analyst
   → repositories.getCoinHistory() / getLatestPrice() / compareCoins()
   → Supabase (anon key, lectura)
   → ✅ Sin rate limits, datos frescos, caché persistente
```

---

## 🚀 Próximos pasos (Fase 2 y 3)

### Fase 2: Integración del LLM

1. **Modificar `/api/crypto-ai-analyst/route.ts`:**
   - Reemplazar `coincapClient.fetchMarketDataForQuery()` 
   - Por llamadas a `src/database/repositories.ts`
   - Reutilizar `intent-detector.ts` solo para clasificar la pregunta
   - Actualizar `analyzeCryptoQuery()` para recibir datos estructurados de Supabase

2. **Mantener o eliminar `src/features/crypto/lib/coincap-provider.ts`:**
   - Si otras rutas lo usan, dejarlo
   - Si solo lo usaba el analista, eliminarlo

3. **Agregar tests:**
   - Tests unitarios para `src/services/metrics.ts`
   - Tests de integración para `src/database/repositories.ts` con datos mockeados de Supabase
   - Tests E2E en Playwright para `/api/crypto-ai-analyst` respondiendo desde Supabase

### Fase 3: Deployment y monitoreo

1. **En Supabase production:**
   - Ejecutar migraciones 003-007
   - Crear Edge Functions desde CLI o Dashboard
   - Configurar variables de entorno

2. **Inicializar datos:**
   - Correr `syncInitial` para BTC, ETH, y otras monedas clave
   - Dejar correr diario + intraday cron por 24-48h

3. **Verificar:**
   - Que las tablas se crecen sin error
   - Que CoinCap API calls bajaron > 95%
   - Que `/api/crypto-ai-analyst` responde desde Supabase sin latencia

---

## 📊 Estadísticas esperadas

| Métrica | Antes | Después |
|---------|-------|---------|
| CoinCap API calls/hora | ~100-1000 (variable, depende del tráfico del LLM) | ~1-2 (solo cron) |
| Rate limits alcanzados | Sí, frecuentemente ❌ | No ✅ |
| Latencia respuesta LLM | Espera por CoinCap API (~1-5s) | Espera por Supabase (~50-200ms) |
| Caché persistencia | No (se pierde en redeploy) | Sí (BD es persistente) |

---

## ✅ Checklist para ir a Fase 2

- [ ] Migraciones 003-007 corridas en Supabase
- [ ] Tabla `coins` poblada con al menos BTC, ETH
- [ ] `syncInitial` ejecutado exitosamente (verificar price_daily + coin_metrics)
- [ ] Edge Functions deployed y funcionando
- [ ] Cron jobs corriendo (verificar en `cron.job_run_details`)
- [ ] Tests E2E verdes para analista IA actual (baseline)
- [ ] Listo para modificar `/api/crypto-ai-analyst`

---

## 🔍 Verificación rápida

Mientras preparas Fase 2, puedes verificar todo localmente:

```bash
# 1. Popula coins de prueba
psql "your-database-url" -c "INSERT INTO public.coins (symbol, name, coincap_id) VALUES ('BTC', 'Bitcoin', 'bitcoin');"

# 2. Corre syncInitial manualmente en Node.js
node -e "
const { syncInitialForCoin } = require('./src/sync/syncInitial.ts');
syncInitialForCoin({ symbol: 'BTC', name: 'Bitcoin', coincapId: 'bitcoin' })
  .then(r => console.log('✓', r))
  .catch(e => console.error('✗', e.message));
"

# 3. Verifica que price_daily tiene datos
psql "your-database-url" -c "SELECT COUNT(*) as candles FROM public.price_daily;"

# 4. Verifica que coin_metrics tiene métricas
psql "your-database-url" -c "SELECT ytd_return, ath, drawdown FROM public.coin_metrics LIMIT 1;"
```

---

## 📝 Notas

- **Timestamps**: Todos están en UTC (TIMEZONE 'UTC')
- **Numeric precision**: Precios usualmente 20,8 (Bitcoin en 6 cifras); volumen/market cap 20,2
- **No duplicados**: `price_daily` tiene UNIQUE(coin_id, date), así que upserts son seguros
- **Backfill**: Si necesitas recargar datos de una moneda, simplemente elimina sus registros y corre `syncInitial` de nuevo
- **Rollback**: Migraciones están estructuradas para ser reversibles si es necesario

---

Próximo: 👉 **Fase 2 - Integrar el LLM con Supabase repositories**
