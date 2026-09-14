# DashTestify — Crypto Dashboard + Playwright E2E Testing

A modern cryptocurrency dashboard built with **Next.js** and **TypeScript**, featuring real-time data visualization, comprehensive **Playwright E2E testing**, and an AI-powered QA analytics dashboard for failure analysis.

Perfect for learning modern testing practices, CI/CD pipelines, and production-grade web development.

---

## 🚀 Quick Links

| Link | Purpose |
|------|---------|
| 🌐 **[Live Dashboard](https://dash-testify.vercel.app/)** | View the live cryptocurrency dashboard |
| 📊 **[QA Metrics](https://dash-testify.vercel.app/quality-analytics)** | Historical test metrics (Supabase) |
| 🧪 **Test reports** | Download `playwright-report-{run_id}` artifacts from GitHub Actions |

## ✨ Features

### 💰 Cryptocurrency Dashboard
- **Real-time & Mock Modes**: Live CoinCap API v3 data or deterministic mock data
- **Interactive Charts**: 9 timeframes (1H to 5M) with Recharts
- **Smart Search**: Filter by coin name or symbol
- **Sorting Options**: Market cap, price, 24H change
- **Watchlist**: Save favorite coins locally
- **Price Alerts**: Get notified when prices hit targets
- **Trade Journal**: Keep per-coin trading notes

### 🤖 AI-Powered QA Analytics (Local Dev)
- **AI Failure Analysis**: Auto-analyze test failures with Claude, OpenAI, Gemini, etc.
- **Suggested Fixes**: AI generates code patches for failing tests
- **Flaky Test Detection**: Identify unstable tests
- **Top Failures**: Aggregate and track failure patterns
- **Confidence Scoring**: Trust metrics for AI suggestions

### 📊 Production Analytics (with Supabase)
- **Historical Metrics**: Track test trends over time
- **Branch Health**: Monitor code quality per branch
- **Test Runs**: Complete audit of all test executions

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
- **HTML reports uploaded as GitHub Actions artifacts** (per run)

## 🤖 AI-assisted Development

AI tools were used to support test case generation, code review, and test validation, improving development speed and overall testing efficiency.

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router) | Full-stack React with server components |
| **Language** | TypeScript | Type-safe JavaScript |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **State & Data** | TanStack Query | Server state management & caching |
| **Charts** | Recharts | Interactive React charts |
| **Testing** | Playwright | Browser automation & E2E tests |
| **API** | Axios | HTTP client for API calls |
| **Data Source** | CoinCap API v3 | Live cryptocurrency market data |

### 📂 Project Structure

```
src/
├── app/
│   ├── page.tsx                       # Main crypto dashboard
│   ├── quality-analytics/             # Supabase metrics dashboard
│   ├── ai-failure-analysis/           # Local AI analysis (dev-only, redirects in prod)
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

### Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **npm** 9+ (check with `npm --version`)
- **Git** (check with `git --version`)

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

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

✅ The app works **out of the box** with mock data — no API keys needed!

### 3. Explore the App

| Route | What You'll See |
|-------|-----------------|
| `/` | Cryptocurrency dashboard with live prices and charts |
| `/quality-analytics` | Historical metrics from Supabase (trends, flaky tests, branch health) |
| `/ai-failure-analysis` | Local AI failure analysis & run Playwright (development only) |

### 4. Run Tests (Optional)

```bash
# Run all E2E tests in mock mode (recommended)
npm run test:e2e

# View interactive test UI
npm run test:e2e:ui

# See the test report
npm run test:e2e:report
```

---

## 📚 For Beginners

### What is E2E Testing?
**End-to-End (E2E) testing** simulates real user interactions by controlling a browser. Instead of unit tests that test code in isolation, E2E tests verify that the entire application works correctly from a user's perspective.

**Example**: An E2E test might:
1. Click the search box
2. Type "bitcoin"
3. Verify that bitcoin appears in results
4. Click on bitcoin
5. Verify the price chart loads

### Why Playwright?
- **Fast & reliable**: Runs tests in parallel with minimal flakiness
- **Multi-browser**: Test in Chrome, Firefox, Safari
- **Great debugging**: Built-in inspector, screenshots, traces
- **No setup headaches**: Works out of the box

### Why AI for Failure Analysis?
When a test fails, the AI analyzes:
- The error message
- The code that was running
- The test file context
- The application code

Then it **suggests fixes** — sometimes even auto-generating code patches. Perfect for learning and rapid debugging during development.

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

The project includes two related QA surfaces:

### Access Routes

| URL | Mode | Purpose |
|-----|------|---------|
| `/quality-analytics` | Local or production | Historical metrics from Supabase |
| `/ai-failure-analysis` | Local development only | AI failure analysis + run Playwright (redirects to `/quality-analytics` in production) |

### Metrics (`/quality-analytics`)

**Local:** [http://localhost:3000/quality-analytics](http://localhost:3000/quality-analytics)  
**Production:** [https://dash-testify.vercel.app/quality-analytics](https://dash-testify.vercel.app/quality-analytics)

Shows **historical aggregate metrics** from uploaded test runs:

- 📈 Total test runs over time
- 📊 Historical trend chart
- 🔴 Top failures across all runs
- 🐛 Flaky test detection
- 🌿 Branch health metrics

**Requirements:** Supabase configuration (see below). Without it, the page shows a clear configuration/error message.

### AI Failure Analysis (`/ai-failure-analysis`, development only)

**Available at:** [http://localhost:3000/ai-failure-analysis](http://localhost:3000/ai-failure-analysis)

Shows AI-powered analysis of your **most recent local test run**:

- ✅ Test results (pass/fail/duration)
- ❌ Latest test failures with error details and stack traces
- 🤖 AI-generated analysis of each failure
- 🔧 AI-suggested fixes with code patches
- ⚡ Real-time test execution monitoring
- 📋 Structured breakdown of failures by test file

**Requirements:** None for viewing local results — works after `npm run test:e2e`. The local-only API routes that run tests or apply patches are blocked in production deployments.

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

### Supabase Configuration (Optional — for metrics)

To enable historical metrics tracking, set these environment variables:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_key
```

> **Note:** Local AI failure analysis does not require Supabase. Metrics on `/quality-analytics` do.

## 🔧 Troubleshooting

### "Port 3000 already in use"
```bash
# Use a different port
npm run dev -- -p 3001
```

### "Tests fail with timeout errors"
```bash
# Increase the timeout
npm run test:e2e -- --timeout=60000
```

### "Mock data not loading"
Restart the dev server:
```bash
npm run dev
```

### "TypeScript errors in IDE"
Your IDE might be cached. Try:
```bash
npm run build
```

### "Need live CoinCap data?"
Get a free API key from [rest.coincap.io](https://rest.coincap.io), add it to `.env`:
```bash
COINCAP_API_KEY=your_key_here
```
Then restart with `npm run dev`.

---

## 🎓 What This Project Demonstrates

- **Test Automation**: Reliable E2E testing with Playwright & Page Object Model
- **Modern React**: Next.js, server components, and client interactivity
- **TypeScript**: Type-safe development at scale
- **CI/CD Pipelines**: Automated testing & deployment with GitHub Actions
- **AI Integration**: Leveraging LLMs for intelligent failure analysis
- **API Integration**: Handling real APIs with fallback mock data
- **Performance**: Server-side rendering, caching, and optimization

---

## ⚙️ CI/CD Pipeline

This project uses **GitHub Actions** to:
- Run tests on every push and pull request
- Act as a quality gate before merging
- Deploy to Vercel on successful builds
- Upload Playwright HTML reports as per-run artifacts (`playwright-report-{run_id}`)

See `.github/workflows/` for pipeline configuration and [docs/ARTIFACT_BASED_REPORTING.md](docs/ARTIFACT_BASED_REPORTING.md) for how to download reports.

## 📄 License

MIT
