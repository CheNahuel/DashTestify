# Fase 3: Deployment Completo en Supabase Production

**Fecha de inicio:** Hoy
**Proyecto Supabase:** `kayzrduiqcxvwwjftttk` (https://kayzrduiqcxvwwjftttk.supabase.co)
**Migraciones:** 003-007 ✅ Ya ejecutadas en producción

---

## 📋 Pasos (hazlos en orden)

### PASO 1: Deploy Edge Functions

Las Edge Functions ejecutan la lógica de sincronización periódica.

```bash
# 1. Ir a tu proyecto Supabase en el Dashboard
# Project → Functions

# 2. Crear o actualizar las Edge Functions
# Nota: Los archivos ya existen en: supabase/functions/sync-daily/ y sync-intraday/

# 3. Deploy desde CLI (si tienes Supabase CLI)
supabase functions deploy sync-daily
supabase functions deploy sync-intraday

# 4. Verificar que se desplegaron
supabase functions list
```

**Si no tienes Supabase CLI**, haz esto en el Dashboard:

1. **Dashboard → Functions → Create a new function**
2. **Name:** `sync-daily`
3. **Paste el contenido de:** `supabase/functions/sync-daily/index.ts`
4. **Deploy**
5. **Repetir para `sync-intraday`**

---

### PASO 2: Configurar variables de entorno en Edge Functions

Las Edge Functions necesitan saber:
- `NEXT_PUBLIC_URL`: URL de tu Next.js app (ej: `https://tudominio.com` o `http://localhost:3000` para testing)
- `INTERNAL_SYNC_SECRET`: El secreto que protege los endpoints `/api/internal/sync-*`

```bash
# Via CLI (si tienes Supabase CLI)
supabase secrets set \
  NEXT_PUBLIC_URL="https://tudominio.com" \
  INTERNAL_SYNC_SECRET="tu-secreto-aqui"

# Verificar
supabase secrets list
```

**Si prefieres el Dashboard:**

1. **Dashboard → Settings → Edge Functions → Environment Variables**
2. **Add variable:**
   - Name: `NEXT_PUBLIC_URL`
   - Value: `https://tudominio.com`
3. **Add variable:**
   - Name: `INTERNAL_SYNC_SECRET`
   - Value: Tu valor de `INTERNAL_SYNC_SECRET` (debe coincidir con `.env` local)

---

### PASO 3: Configurar pg_cron

Ya ejecutaste las migraciones 003-007, así que pg_cron ya está configurado.

**Pero necesitas establecer el secreto que pg_cron usará:**

En el **SQL Editor** de Supabase Dashboard:

```sql
-- Set the sync secret for pg_cron to use
ALTER DATABASE "kayzrduiqcxvwwjftttk" 
SET "app.internal_sync_secret" = 'TU-SYNC-SECRET-AQUI';

-- Verificar que el cron job está configurado
SELECT * FROM cron.job WHERE jobname LIKE 'sync-crypto%';

-- Verificar estado de ejecución
SELECT * FROM cron.job_run_details LIMIT 10;
```

---

### PASO 4: Inicializar monedas

Inserta las monedas (Bitcoin, Ethereum, etc.) en la tabla `coins`.

**Opción A: Via script (recomendado)**

```bash
# Asegúrate que estas env vars estén configuradas
export SUPABASE_URL="https://kayzrduiqcxvwwjftttk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"

# Ejecutar script
npx ts-node scripts/init-crypto-coins.ts
```

**Opción B: Via SQL en Supabase Dashboard**

```sql
INSERT INTO public.coins (symbol, name, coincap_id, coingecko_id)
VALUES
  ('BTC', 'Bitcoin', 'bitcoin', 'bitcoin'),
  ('ETH', 'Ethereum', 'ethereum', 'ethereum'),
  ('SOL', 'Solana', 'solana', 'solana'),
  ('BNB', 'Binance Coin', 'binance-coin', 'binance'),
  ('ADA', 'Cardano', 'cardano', 'cardano'),
  ('XRP', 'XRP', 'ripple', 'ripple'),
  ('DOGE', 'Dogecoin', 'dogecoin', 'dogecoin'),
  ('LINK', 'Chainlink', 'chainlink', 'chainlink'),
  ('USDT', 'Tether', 'tether', 'tether'),
  ('USDC', 'USD Coin', 'usd-coin', 'usd-coin')
ON CONFLICT (symbol) DO NOTHING;

-- Verificar
SELECT COUNT(*) FROM public.coins;
```

---

### PASO 5: Ejecutar sincronización inicial

Ahora que tienes monedas, sincroniza sus datos históricos y métricas.

**Opción A: Llamar a tu Edge Function**

```bash
curl -X POST https://kayzrduiqcxvwwjftttk.supabase.co/functions/v1/sync-intraday \
  -H "Authorization: Bearer TU-SYNC-SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Respuesta esperada:
# {"success": true, "message": "Intraday sync completed", "result": {...}}
```

**Opción B: Llamar a tu endpoint local (si estás desarrollando)**

```bash
curl -X POST http://localhost:3000/api/internal/sync-intraday \
  -H "Authorization: Bearer TU-SYNC-SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Opción C: Via script (más robusto)**

Crea `scripts/run-sync.ts`:

```typescript
import { syncIntraday } from "@/sync/syncIntraday";

async function main() {
  console.log("Running intraday sync...");
  const result = await syncIntraday();
  console.log("✓ Sync complete:", result);
}

main().catch(console.error);
```

Luego:

```bash
npx ts-node scripts/run-sync.ts
```

---

### PASO 6: Verificar que los datos se poblaron

En el **SQL Editor** de Supabase:

```sql
-- Verificar que tenemos monedas
SELECT COUNT(*) as coin_count FROM public.coins;
-- Esperado: 10 (o más si agregaste más)

-- Verificar que tenemos precios recientes
SELECT COUNT(*) as intraday_count FROM public.price_intraday;
-- Esperado: > 0 (depende de si ejecutaste sync)

-- Ver últimos precios
SELECT 
  c.symbol,
  p.price,
  p.timestamp
FROM public.price_intraday p
JOIN public.coins c ON p.coin_id = c.id
ORDER BY p.created_at DESC
LIMIT 5;

-- Verificar que tenemos métricas
SELECT 
  c.symbol,
  m.current_price,
  m.ytd_return,
  m.updated_at
FROM public.coin_metrics m
JOIN public.coins c ON m.coin_id = c.id
LIMIT 5;
```

---

### PASO 7: Probar el LLM endpoint

Una vez que tienes datos en Supabase, prueba que el analista IA funciona:

```bash
curl -X POST http://localhost:3000/api/crypto-ai-analyst \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the price of Bitcoin?"}'

# En los logs, deberías ver:
# [crypto-analyst] Using data source: Supabase
```

**Respuesta esperada:**

```json
{
  "answer": "According to the latest data from Supabase, Bitcoin is currently priced at $...",
  "sources": ["/assets"],
  "provider": "claude"
}
```

Si obtienes un error como "No coins are currently available in the database", entonces:
1. Verifica que las monedas fueron insertadas (PASO 4)
2. Verifica que el sync corrió (PASO 5)

---

### PASO 8: Monitorear los cron jobs

Ahora que pg_cron está configurado, debería ejecutarse automáticamente.

**Ver próximas ejecuciones programadas:**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'sync-crypto%';
```

**Ver historial de ejecuciones:**

```sql
SELECT 
  job_id,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname LIKE 'sync-crypto%'
ORDER BY end_time DESC
LIMIT 10;
```

---

## 🚨 Troubleshooting

### Edge Function returns 404

**Problema:** `curl` al Edge Function devuelve 404

**Causa:** La Edge Function no está deployed o la URL es incorrecta

**Solución:**
```bash
# Verificar URL
supabase functions list

# Verificar que está en: https://PROJECT_ID.supabase.co/functions/v1/sync-daily
# Si no aparece, deploy:
supabase functions deploy sync-daily
```

---

### pg_cron job not executing

**Problema:** El job no ha corrido (status en `job_run_details` es vacío)

**Causa:** El sync secret no está configurado correctamente

**Solución:**
```sql
-- Verificar que el secret está set
SELECT name, setting FROM pg_settings WHERE name = 'app.internal_sync_secret';

-- Si está vacío, configuralo:
ALTER DATABASE "kayzrduiqcxvwwjftttk" 
SET "app.internal_sync_secret" = 'TU-SECRETO';
```

---

### No data in price_intraday or coin_metrics

**Problema:** Corriste sync pero no aparecen datos

**Causa:** Posible error en la Edge Function o en el endpoint

**Solución:**
```bash
# Ver logs de Edge Function
supabase functions logs sync-intraday

# O si usas localhost, revisar los logs del servidor
# Debería decir: "[sync-intraday] Starting intraday sync from Edge Function"
```

---

### LLM devuelve "No coins are currently available"

**Problema:** El analista IA no ve las monedas

**Causa:** Tabla `coins` está vacía o sincronización no corrió

**Solución:**
```sql
-- Verificar monedas
SELECT * FROM public.coins LIMIT 5;

-- Si está vacía, insertar manualmente o ejecutar script del PASO 4

-- Luego ejecutar sync (PASO 5)
```

---

## ✅ Checklist final

- [ ] Edge Functions `sync-daily` e `sync-intraday` deployd
- [ ] Variables de entorno set en Edge Functions (`NEXT_PUBLIC_URL`, `INTERNAL_SYNC_SECRET`)
- [ ] `app.internal_sync_secret` configurado en Supabase Database
- [ ] pg_cron jobs creados (visible en `cron.job`)
- [ ] Monedas insertadas en tabla `coins` (10+ filas)
- [ ] Sincronización ejecutada al menos una vez
- [ ] Datos en `price_intraday` y `coin_metrics` (SELECT COUNT(*) > 0)
- [ ] `/api/crypto-ai-analyst` responde con data de Supabase
- [ ] Logs muestran `[crypto-analyst] Using data source: Supabase`
- [ ] Ningún error de rate limit (429)

---

## 📊 Monitoreo de performance

Una vez desplegado, verifica que los cambios funcionan:

```sql
-- CoinCap API calls deberían ser casi cero (excepto cron)
-- Monitorea en CoinCap dashboard o logs

-- Latencia de LLM endpoint debería ser < 500ms
-- Compara con latencia anterior (1-5 segundos)

-- Frecuencia de cron jobs: 
-- - sync-intraday: cada 5 minutos
-- - sync-daily: una vez al día a las 1 AM UTC
```

---

## 🎯 Próximos pasos

Una vez que todo esté funcionando:

1. **Monitorear** que los cron jobs corren sin errores
2. **Agregar más monedas** si lo necesitas
3. **Optimizar schedules** si la frecuencia de sync no es la correcta
4. **Publicar** en producción con confianza de que no habrá rate limits

---

## 📚 Referencias

- [PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md) - Database schema & sync infrastructure
- [PHASE_2_COMPLETE.md](PHASE_2_COMPLETE.md) - LLM integration with Supabase
- [CRYPTO_SYNC_SETUP.md](CRYPTO_SYNC_SETUP.md) - Detailed architecture docs
- [scripts/setup-crypto-sync.ts](scripts/setup-crypto-sync.ts) - Automated setup helper
- [scripts/init-crypto-coins.ts](scripts/init-crypto-coins.ts) - Coin initialization script
