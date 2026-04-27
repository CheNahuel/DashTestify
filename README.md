# Crypto Intelligence Dashboard (Next.js + Playwright E2E Testing)

A modern cryptocurrency dashboard built with Next.js, showcasing real-time data visualization and a production-like end-to-end testing setup using Playwright.

---

## 🌐 Live Demo

👉 https://dash-testify.vercel.app/

## 🧪 Test Report (Playwright)

👉 https://chenahuel.github.io/DashTestify/

## 🚀 Features

- Real-time crypto data from CoinCap API v3
- Mock data mode for offline use and deployments without an API key
- Interactive historical charts (24H, 7D, 30D, 90D)
- Smart search and filtering (by name or symbol)
- Sort by market cap, price, or 24H change
- Trade journal with per-coin notes
- Price alerts with email and persistence
- Watchlist with localStorage persistence
- Responsive dark UI

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

Create a `.env.local` file at the project root (it is git-ignored):

```bash
COINCAP_API_KEY=your_api_key_here
```

Restart the dev server after adding the key. The app detects the key at startup; no code change is needed.

#### Endpoints used

| Endpoint | Description |
|---|---|
| `GET /v3/assets?limit=20` | Top 20 coins by market cap |
| `GET /v3/assets/{slug}/history` | OHLCV history for a coin |

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
│   ├── api/coins/
│   │   ├── markets/            # CoinCap proxy — GET /api/coins/markets[?mock=1]
│   │   └── [coinId]/history/   # History proxy  — GET /api/coins/:id/history
│   ├── actions.ts              # Price alert server action
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── Container.tsx
└── features/crypto/
    ├── api/                    # Client-side fetch helpers (getCoins, getCoinHistory)
    ├── components/             # CryptoDashboard, CoinCard, CoinChart, …
    ├── hooks/                  # useCoins, useCoinHistory (TanStack Query)
    ├── server/
    │   ├── getCoinsFromCoinCap.ts      # Live asset fetcher + in-memory cache
    │   ├── getCoinHistoryFromCoinCap.ts # Live history fetcher + in-memory cache
    │   └── mockCryptoData.ts           # Offline mock for all 20 CoinCap top coins
    └── types/                  # Coin, CoinHistory, PriceAlertFormState

tests/
├── e2e/dashboard/
│   ├── data.spec.ts        # Price, chart, stat-card rendering
│   ├── data-source.spec.ts # Mock ↔ Live toggle behavior
│   ├── error.spec.ts       # API error and unavailable states
│   ├── interactions.spec.ts# Sort, trend, watchlist, journal, alerts, ranges
│   └── smoke.spec.ts       # Basic render smoke tests
│   └── search.spec.ts      # Search by name/symbol, URL params, visibility
├── fixtures/testSetup.ts   # Playwright fixture with route interception
├── pages/DashboardPage.ts  # Page Object Model
├── data/testData.json      # Stable mock data for tests
└── utils/
    ├── commonUtils.ts
    └── dateUtils.ts
```

### ▶️ Run Application

```bash
npm install
npm run dev
```

### 🧪 Run Tests

```bash
npm run test:e2e
```

Tests always run against mock API routes regardless of whether `COINCAP_API_KEY` is set, so they work offline and in CI without a real key.

### 📊 Open Report

```bash
npm run test:e2e:report
```

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
