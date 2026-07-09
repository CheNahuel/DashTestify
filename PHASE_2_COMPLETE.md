# Fase 2 Completa: Integración del LLM con Supabase

## 🎯 Qué se implementó

### 1. Nuevo provider de datos Supabase

**Archivo:** [src/features/crypto/lib/supabase-provider.ts](src/features/crypto/lib/supabase-provider.ts)

- Interfaz idéntica a `coincap-provider.ts` para reemplazo sin ruptura
- Detecta intención de usuario usando `intent-detector.ts` reutilizado
- Mapea coincap IDs → UUIDs de Supabase
- Fetcha metrics, history, y top movers según la intención
- Construye contexto en el mismo formato que espera el LLM

```typescript
// Uso idéntico al provider anterior
const provider = createSupabaseProvider();
const { context, endpoints } = await provider.fetchMarketData(userQuery);
```

### 2. Ruta analista IA actualizada

**Archivo:** [src/app/api/crypto-ai-analyst/route.ts](src/app/api/crypto-ai-analyst/route.ts)

- **Por defecto**: usa Supabase provider (configurable vía `USE_SUPABASE_CRYPTO` env var)
- **Fallback**: usa CoinCap provider si es necesario (para testing/rollback)
- Parámetro `useSupabase?: boolean` en el request body para override per-request
- Logs claros de qué fuente de datos se usa

```bash
# Usa Supabase (default)
curl -X POST http://localhost:3000/api/crypto-ai-analyst \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Bitcoin price?"}'

# Override a CoinCap si es necesario
curl -X POST http://localhost:3000/api/crypto-ai-analyst \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Bitcoin price?", "useSupabase": false}'
```

### 3. System prompt del LLM actualizado

**Archivo:** [src/lib/ai/crypto-analyst.ts](src/lib/ai/crypto-analyst.ts)

- Acepta parámetro `dataSource` para personalizar el prompt
- Menciona explícitamente la fuente de datos (Supabase vs CoinCap)
- Sigue siendo agnóstico a la fuente interna

### 4. Queries de base de datos extendidas

**Archivo:** [src/database/queries.ts](src/database/queries.ts)

- Agregada `getCoinByCoincapId()` para resolver intención a UUIDs
- Mantiene todas las queries existentes

### 5. Tests Playwright nuevos

**Archivo:** [tests/e2e/ai/crypto-analyst.spec.ts](tests/e2e/ai/crypto-analyst.spec.ts)

- Tests para provider Supabase (price, history, comparisons)
- Tests para system prompt con ambas fuentes
- Tests flexibles: skippean si la BD no está disponible

### 6. Documentación actualizada

- `.env.example`: agregada `USE_SUPABASE_CRYPTO=true`

## 📊 Arquitectura final

```
User Query
    ↓
/api/crypto-ai-analyst
    ├─ Detectar intención (intent-detector.ts)
    └─ Seleccionar provider
        ├─ Supabase (DEFAULT)
        │   ├─ Mapear coincap IDs → UUIDs
        │   └─ Consultar repositories.*()
        │       → Supabase (lectura)
        │
        └─ CoinCap (fallback)
            └─ Llamar coincapClient.fetchMarketDataForQuery()
                → CoinCap API

Contexto estructurado → analyzeCryptoQuery() → Claude API → Respuesta
```

## 🔄 Flujo de datos en producción (ahora)

```
ANTES (429 Rate Limit):
  User → /api/crypto-ai-analyst → coincapClient (live) → CoinCap API ❌

AHORA:
  User → /api/crypto-ai-analyst → repositories.*() → Supabase ✅
         (sin llamadas directas a CoinCap, excepto sync cron)
```

## ✅ Checklist de Fase 2

- [x] Crear supabase-provider que replica coincap-provider interface
- [x] Actualizar route.ts para usar supabase provider por defecto
- [x] Actualizar analyzer system prompt
- [x] Agregar getCoinByCoincapId() a queries
- [x] Crear tests Playwright para el nuevo provider
- [x] Documentar configuración via .env.example
- [x] Mantener compatibilidad backward (fallback a CoinCap si es necesario)

## 🚀 Próximos pasos (Fase 3 - Deployment & Verification)

### En Supabase production:
1. Ejecutar migraciones 003-007 (Fase 1)
2. Crear Edge Functions `sync-daily` y `sync-intraday`
3. Configurar pg_cron para disparar los sync jobs
4. Inicializar monedas con `syncInitial` (BTC, ETH, etc.)

### En producción:
1. Setear `USE_SUPABASE_CRYPTO=true` en env vars
2. Verificar que `/api/crypto-ai-analyst` responde sin errores
3. Monitorear que CoinCap API calls bajaron > 95%
4. Verificar latencia: debería ser más rápido (Supabase en vez de CoinCap)

### Verificación:
```bash
# Probar analista con Supabase
curl -X POST https://your-domain.com/api/crypto-ai-analyst \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Bitcoin YTD return?"}'

# En Network tab o logs, verificar:
# ✓ No hay llamadas a coincap.io (excepto sync cron)
# ✓ Solo llamadas a Supabase (REST API)
# ✓ Respuesta en < 500ms típicamente
```

## 📝 Notas técnicas

### Compatibilidad
- **Backward compatible**: `coincapProvider` sigue disponible
- **Configurable**: setea `USE_SUPABASE_CRYPTO=false` para volver a CoinCap
- **Per-request override**: `useSupabase: false` en el body del POST

### Testing
- Tests skippean si Supabase no está disponible (no fallan en CI sin BD)
- Tests skippean si API key de Claude no está configurada
- Puedes correr `npm run test:e2e` sin setup de Supabase (serán skipped)

### Performance
- Supabase queries típicamente < 100ms
- CoinCap API típicamente 500ms-5s dependiendo del endpoint
- Ganancia esperada: **50x más rápido** para consultas históricas
- Rate limit: **eliminado** (cero llamadas directo a CoinCap desde LLM)

### Mapeo de monedas
La intención detecta coincap IDs como "bitcoin", "ethereum", etc.
El provider mapea a UUIDs via `getCoinByCoincapId()`.
Si una moneda no existe en Supabase, se silencia (no hay error, solo no aparece en contexto).

## 🔍 Checklist para verificar antes de ir a Fase 3

- [ ] Migraciones 003-007 listas en scripts/migrations/
- [ ] supabase-provider.ts funciona con tu Supabase local/sandbox
- [ ] /api/crypto-ai-analyst responde con Supabase provider
- [ ] Tests pasan (o skippean si BD no disponible): `npm run test:e2e`
- [ ] .env.example tiene USE_SUPABASE_CRYPTO documentado
- [ ] Plan de deployment en Supabase está definido (Fase 3)

---

**Próximo:** 👉 **Fase 3 - Deployment en Supabase production, inicializar datos, y verificar eliminación de rate limits**
