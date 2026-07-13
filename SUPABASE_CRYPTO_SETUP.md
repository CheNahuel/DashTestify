# Configuración de Supabase para Datos Históricos de Criptomonedas

## Objetivo

Almacenar datos históricos de precios de criptomonedas en Supabase para:
- ✅ Evitar llamadas innecesarias a CoinCap
- ✅ Tener datos consistentes y históricos
- ✅ Servir el AI Analyst desde datos locales en lugar de API externa

## Estructura de Datos

### Tabla `coins`
Almacena información de monedas soportadas:
```sql
id (uuid primary key)
symbol (text) - BTC, ETH, etc.
name (text) - Bitcoin, Ethereum, etc.
coincap_id (text) - coincap ID
coingecko_id (text) - opcional, CoinGecko ID
created_at (timestamp)
updated_at (timestamp)
```

### Tabla `price_daily`
Almacena precios históricos diarios (OHLC):
```sql
id (uuid primary key)
coin_id (uuid fkey → coins.id)
date (date)
open (numeric)
high (numeric)
low (numeric)
close (numeric)
volume (numeric)
market_cap (numeric)
unique (coin_id, date)
```

### Tabla `price_intraday`
Almacena precios recientes/intradiarios:
```sql
id (uuid primary key)
coin_id (uuid fkey → coins.id)
timestamp (timestamp)
price (numeric)
market_cap (numeric)
volume_24h (numeric)
change_24h (numeric)
```

## Pasos de Configuración

### 1. Configurar Variables de Entorno

Asegúrate de tener en `.env.local`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key  # Required for seeding

# CoinCap
COINCAP_API_KEY=your-coincap-api-key

# Para usar Supabase como data source por defecto (opcional)
USE_SUPABASE_CRYPTO=true
```

### 2. Ejecutar Migraciones

Primero, crea el schema en Supabase:

```bash
# Opción 1: Usar el script setup-db.ts
npm run setup:db

# Opción 2: Manual - ir a Supabase > SQL Editor y ejecutar en orden:
# 1. scripts/migrations/003_create_coins.sql
# 2. scripts/migrations/004_create_price_daily.sql
# 3. scripts/migrations/005_create_price_intraday.sql
```

### 3. Llenar Datos Históricos

Ejecuta el script de seeding para llenar Supabase con datos de CoinCap:

```bash
tsx scripts/seed-crypto-data.ts
```

**Qué hace:**
1. Obtiene las 10 monedas soportadas (BTC, ETH, SOL, etc.)
2. Inserta registros en tabla `coins`
3. Obtiene 1 año de histórico de CoinCap
4. Inserta precios diarios en tabla `price_daily`

**Output esperado:**
```
🚀 Starting crypto data seeding...

📝 Step 1: Inserting coin records...
✅ Inserted 10 coins

📊 Step 2: Fetching price history from CoinCap...
  Fetching history for BTC...
  ✅ BTC: 365 price points
  Fetching history for ETH...
  ✅ ETH: 365 price points
  ...

📤 Step 3: Inserting 3650 price records...
  ✅ Inserted batch 1/37
  ✅ Inserted batch 2/37
  ...

✨ Crypto data seeding completed successfully!

📊 Summary:
  - Coins: 10
  - Price records: 3650
```

### 4. Verificar Datos en Supabase

Ir a Supabase Dashboard > SQL Editor y ejecutar:

```sql
-- Ver monedas
SELECT symbol, name, coincap_id FROM coins LIMIT 10;

-- Ver precios históricos
SELECT c.symbol, p.date, p.close, p.volume 
FROM price_daily p
JOIN coins c ON p.coin_id = c.id
ORDER BY c.symbol, p.date DESC
LIMIT 50;

-- Contar registros
SELECT COUNT(*) FROM coins;
SELECT COUNT(*) FROM price_daily;
```

## Permisos en Supabase

La configuración RLS permite:
- ✅ **Lectura pública** - Los clientes pueden leer monedas y precios
- ✅ **Escritura service role** - Solo el backend (con service key) puede escribir

```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename IN ('coins', 'price_daily', 'price_intraday');
```

Si hay error de permisos, ejecuta en SQL Editor:

```sql
-- Permitir lectura anónima
CREATE POLICY "Allow public read" ON coins
  FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON price_daily
  FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON price_intraday
  FOR SELECT USING (true);

-- Permitir escritura service role
CREATE POLICY "Allow service role" ON coins
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

## Usar Supabase como Data Source

### Opción A: Por defecto para todo

Agrega a `.env.local`:
```bash
USE_SUPABASE_CRYPTO=true
```

Ahora `/api/crypto-ai-analyst` usará Supabase en lugar de CoinCap.

### Opción B: Seleccionar por request

```javascript
// Usar Supabase
POST /api/crypto-ai-analyst
{ "query": "Compare Bitcoin and Ethereum", "useSupabase": true }

// Usar CoinCap (default)
POST /api/crypto-ai-analyst
{ "query": "Compare Bitcoin and Ethereum" }
```

## Actualizar Datos Regularmente

Ejecutar el script periódicamente para mantener datos frescos:

```bash
# Manualmente
tsx scripts/seed-crypto-data.ts

# Con cron (en servidor)
0 0 * * * cd /path/to/project && npm run seed:crypto
```

O usar pg_cron de Supabase (ver `scripts/migrations/007_setup_pg_cron.sql`).

## Repositorios de Base de Datos

Ubicación: `src/database/repositories.ts`

Funciones disponibles:
- `getAllSupportedCoins()` - Obtiene todas las monedas
- `getCoinByCoincapId(id)` - Obtiene moneda por ID de CoinCap
- `getCoinHistory(coinId)` - Obtiene histórico de precios
- `getCoinMetrics(coinId)` - Obtiene métricas actuales
- `getTopMovers(limit, timeframe)` - Top gainers/losers

## Troubleshooting

### Error: "permission denied for table coins"

```bash
# Verificar que usas SUPABASE_SERVICE_KEY
echo $SUPABASE_SERVICE_KEY
```

### Error: "No coins are currently available"

```bash
# Verificar que migraciones se ejecutaron
# En Supabase > SQL Editor:
SELECT COUNT(*) FROM coins;
```

### Error: "ForeignKeyError"

```bash
# Verificar que coins se insertó antes que price_daily
SELECT * FROM coins LIMIT 5;
```

## Arquitectura Final

```
┌─────────────────────────────┐
│   Crypto AI Analyst         │
│   POST /api/crypto-ai-analyst
└──────────┬──────────────────┘
           │
      useSupabase?
      /         \
    YES         NO
    │            │
    ▼            ▼
┌─────────┐   ┌──────────┐
│Supabase │   │ CoinCap  │
│ (local) │   │ (API)    │
└─────────┘   └──────────┘
    │              │
    └──────┬───────┘
           │
    ┌──────▼──────────┐
    │  AI Analyzer    │
    │ (Claude/OpenAI) │
    └─────────────────┘
```

**Ventajas de Supabase:**
- ✅ Sin rate limits
- ✅ Datos históricos completos
- ✅ Análisis más profundos
- ✅ Respuestas consistentes

**Ventajas de CoinCap:**
- ✅ Datos en tiempo real
- ✅ No requiere setup inicial
- ✅ Perfecta para verificar
