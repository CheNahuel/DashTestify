# Crypto Intelligence Dashboard (Next.js + Playwright E2E Testing)

A modern cryptocurrency dashboard built with Next.js, showcasing real-time data visualization and a production-like end-to-end testing setup using Playwright.

---

## 🌐 Live Demo

👉 https://dash-testify.vercel.app/

## 🧪 Test Report (Playwright)

👉 https://chenahuel.github.io/DashTestify/

## 📊 QA Analytics

👉 https://dash-testify.vercel.app/quality-analytics

## 🚀 Features

### Crypto Dashboard
- 🔗 Real-time data from CoinCap API v3 (or mock mode for offline)
- 📊 Interactive historical charts (H1, H2, H6, H12, D1, M1, M5, M15, M30)
- 🔍 Smart search & filtering by name or symbol
- 📈 Sort by market cap, price, or 24H change
- 📔 Trade journal with per-coin notes
- 🔔 Price alerts with email and localStorage persistence
- ⭐ Watchlist with localStorage persistence

### QA Analytics Dashboard
- 🤖 AI-powered failure analysis & fix suggestions (local development)
- 📈 Historical test metrics & trends (production)
- 🐛 Flaky test detection & analysis
- 🔴 Top failures tracking & aggregation
- 🌿 Branch health metrics (production with Supabase)

## 📡 Data Sources

### CoinCap API v3

This project uses the [CoinCap REST API v3](https://rest.coincap.io) to fetch live market data.

**Base URL:** `https://rest.coincap.io/v3`  
**Authentication:** Bearer token (API key required)

#### Getting an API key

1. Visit [rest.coincap.io](https://rest.coincap.io) and create an account
2. Generate an API key from your dashboard
3. Copy the key — it is a long hex string

#### Configuring the key locally

Create a `.env` file at the project root (it is git-ignored):

```bash
COINCAP_API_KEY=your_api_key_here
```

Restart the dev server after adding the key. The app detects the key at startup; no code change is needed.

#### Endpoints used

| Endpoint                        | Description                |
| ------------------------------- | -------------------------- |
| `GET /v3/assets?limit=20`       | Top 20 coins by market cap |
| `GET /v3/assets/{slug}/history` | OHLCV history for a coin   |

### Mock data mode

When `COINCAP_API_KEY` is **not set**, the app serves deterministic mock data for all 20 CoinCap top-20 coins with realistic base prices. No network call is made to CoinCap.

When the key **is** set, a **"Mock data / Live data"** toggle button appears in the filter bar. Clicking it adds `?mockData=1` to the URL and forces all fetches through the mock layer. Clicking again removes it and restores live data.

Mock data reflects the top-20 snapshot at the time of the last code update. It is in `src/features/crypto/server/mockCryptoData.ts`.

## 🎯 Why Playwright

This project was built to explore modern end-to-end testing approaches using Playwright, focusing on reliability, speed, and maintainability compared to traditional frameworks.

## 🧪 Testing Strategy

This project emphasizes test reliability and maintainability:

- **End-to-End Testing with Playwright**
- **Page Object Model (POM)** for scalable test structure
- **API route mocking** for deterministic, offline-safe test results
- **Behavior-based test separation** (data, search, error, interactions, data-source)
- **`data-testid` selectors** for stable UI targeting
- **CI integration with GitHub Actions**
- **Automated HTML reports published via GitHub Pages**

## 🤖 AI-assisted Development

AI tools were used to support test case generation, code review, and test validation, improving development speed and overall testing efficiency.

## 🛠 Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query
- Recharts
- Playwright (E2E Testing)
- CoinCap API v3
- Axios

### 📂 Project Structure

```
src/
├── app/
│   ├── page.tsx                       # Main crypto dashboard
│   ├── quality-analytics/             # Main QA dashboard (local & live modes)
│   ├── ai-failure-analysis/           # AI analysis page (dev-only, redirects in prod)
│   ├── api/
│   │   ├── coins/markets/             # CoinCap proxy — GET /api/coins/markets[?mock=1]
│   │   ├── coins/[coinId]/history/    # History proxy — GET /api/coins/:id/history
│   │   └── quality-analytics/         # QA analytics API routes
│   ├── actions.ts                     # Price alert server action
│   ├── globals.css
│   ├── layout.tsx
│   └── layout.tsx
├── components/
│   ├── Container.tsx
│   └── quality-analytics/
│       ├── metrics-page.tsx           # Main QA dashboard view
│       ├── ai-failure-analysis-page.tsx # AI analysis & fixes UI
│       ├── branch-health-widget.tsx   # Branch health metrics
│       ├── flaky-tests-widget.tsx     # Flaky test detection
│       ├── top-failures-widget.tsx    # Top failures list
│       └── types.ts
├── lib/
│   └── quality-analytics/             # QA analytics utilities
└── features/crypto/
    ├── api/                           # Client-side fetch helpers
    ├── components/                    # CryptoDashboard, CoinCard, CoinChart, etc.
    ├── hooks/                         # useCoins, useCoinHistory (TanStack Query)
    ├── server/
    │   ├── getCoinsFromCoinCap.ts     # Live CoinCap API fetcher
    │   ├── getCoinHistoryFromCoinCap.ts # Live history fetcher
    │   └── mockCryptoData.ts          # Offline mock data (20 top coins)
    └── types/

tests/
├── e2e/
│   ├── dashboard/
│   │   ├── data.spec.ts               # Price, chart, stat rendering
│   │   ├── data-source.spec.ts        # Mock ↔ Live toggle
│   │   ├── error.spec.ts              # Error & unavailable states
│   │   ├── interactions.spec.ts       # Sorting, alerts, watchlist
│   │   ├── search.spec.ts             # Search & filtering
│   │   └── smoke.spec.ts              # Basic render tests
│   ├── analytics/
│   │   └── analytics.spec.ts          # QA dashboard tests
│   ├── fixtures/testSetup.ts          # Playwright setup & route mocking
│   ├── pages/DashboardPage.ts         # Page Object Model
│   ├── data/testData.json             # Mock test data
│   └── utils/
│       ├── commonUtils.ts
│       └── dateUtils.ts
```

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/CheNahuel/DashTestify.git
cd DashTestify
npm install
```

### 2. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app works with **mock data by default** — no API keys needed.

### 3. Explore the App

| URL | Purpose |
|-----|---------|
| `/` | Main cryptocurrency dashboard |
| `/quality-analytics` | QA dashboard (test results, AI analysis, metrics) |
| `/ai-failure-analysis` | Direct link to AI failure analysis (dev-only) |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root. All variables are optional unless noted:

### Crypto Dashboard

```bash
# (Optional) CoinCap API key for live data
# Get from: https://rest.coincap.io
COINCAP_API_KEY=your_api_key_here
```

### QA Analytics (AI-Powered Failure Analysis)

```bash
# Add one or more for failure analysis (all optional)
CLAUDE_API_KEY=your_key           # Recommended: fast & free tier
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
OPENROUTER_API_KEY=your_key       # Auto-selects free models if left empty

# (Optional) Override default models
CLAUDE_MODEL=claude-haiku-4-5
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash-lite
GROQ_MODEL=llama-3.3-70b-versatile
DEEPSEEK_MODEL=deepseek-chat
```

### Live Metrics (Production with Supabase)

```bash
# (Optional) Supabase config for production deployments only
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key
```

---

## 🔗 Using Live CoinCap Data

To fetch **real cryptocurrency data** instead of mock data:

1. Visit [rest.coincap.io](https://rest.coincap.io) and create a free account
2. Generate an API key from your dashboard
3. Add it to your `.env` file:

```bash
COINCAP_API_KEY=your_api_key_here
```

4. Restart the dev server. The app now fetches live data.

**Toggle between modes:** Once configured, a "Mock data / Live data" toggle button appears in the dashboard's filter bar.

---

## 🧪 Testing

### Run Tests

```bash
# Mock mode (default) — no API key needed, works offline and in CI
npm run test:e2e

# Live mode — requires COINCAP_API_KEY to be set
npm run test:e2e:live

# Interactive Playwright UI
npm run test:e2e:ui

# View HTML test report
npm run test:e2e:report
```

Tests use the **Page Object Model (POM)** pattern and are located in `tests/e2e/`. Each test suite focuses on a specific behavior (data, search, sorting, alerts, etc.).

---

## 📊 QA Analytics Dashboard

The project includes a **QA Analytics Dashboard** for analyzing test results, investigating failures, and monitoring test health.

### Access Routes

| URL | Mode | Purpose |
|-----|------|---------|
| `/quality-analytics` | Auto-detected | Main dashboard (local dev / live production) |
| `/ai-failure-analysis` | Local dev only | AI-powered failure analysis (redirects in production) |

### Local Mode (Development)

**Available at:** [http://localhost:3000/quality-analytics](http://localhost:3000/quality-analytics)

Shows AI-powered analysis of your **most recent local test run**:

- ✅ Test results (pass/fail/duration)
- ❌ Latest test failures with error details and stack traces
- 🤖 AI-generated analysis of each failure
- 🔧 AI-suggested fixes with code patches
- ⚡ Real-time test execution monitoring
- 📋 Structured breakdown of failures by test file

**Requirements:** None — works immediately after running `npm run test:e2e`

**AI Analysis Setup (Optional):**

To enable AI-powered failure analysis, add an API key from your preferred provider to `.env`:

```bash
# Choose one or more:
CLAUDE_API_KEY=your_key           # (Recommended) Fast & free tier available
OPENAI_API_KEY=your_key
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
OPENROUTER_API_KEY=your_key       # (Tip) Auto-selects free models if left empty
```

Each provider has sensible defaults. Optionally override the model:

```bash
CLAUDE_MODEL=claude-haiku-4-5
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.0-flash-lite
GROQ_MODEL=llama-3.3-70b-versatile
DEEPSEEK_MODEL=deepseek-chat
```

> **Tip:** Claude (Haiku) and Groq offer free/cheap tiers and are excellent for local testing.

### Live Mode (Production)

**Available at:** [https://dash-testify.vercel.app/quality-analytics](https://dash-testify.vercel.app/quality-analytics) (Vercel deployment only)

Shows **historical aggregate metrics** from all test runs:

- 📈 Total test runs over time
- 📊 Historical trend chart
- 🔴 Top failures across all runs
- 🐛 Flaky test detection
- 🌿 Branch health metrics

**Requirements:** Supabase configuration (see below)

### Supabase Configuration (Optional — Production Only)

To enable live metrics and historical tracking on production deployments, set these environment variables:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key
```

> **Note:** Without Supabase, local analytics still work perfectly. Live metrics are only available on production with Supabase configured.

## ⚙️ CI/CD

- GitHub Actions pipeline runs automated tests on every push and pull request
- Test execution acts as a quality gate before deployment
- On successful validation, the application is automatically deployed to Vercel
- Playwright HTML reports are published via GitHub Pages

## 📈 What This Project Demonstrates

- Designing scalable and maintainable test automation frameworks
- Implementing reliable end-to-end testing strategies with Playwright
- Integrating CI/CD pipelines with automated reporting
- Applying best practices for test stability and maintainability
- Using AI-assisted workflows to enhance testing efficiency

## 📄 License

MIT
