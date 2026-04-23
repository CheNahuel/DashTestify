# Crypto Intelligence Dashboard

A modern cryptocurrency dashboard built with Next.js, focused on real-time data visualization and robust end-to-end testing using Playwright.

---

## 🌐 Live Demo
👉 https://dash-testify.vercel.app/

## 🧪 Test Report (Playwright)
👉 https://chenahuel.github.io/DashTestify/

---

## 🚀 Features

- Real-time crypto data from CoinCap API
- Interactive historical charts (24H, 7D, 30D, 90D)
- Smart search and filtering
- Market overview dashboard
- Trade journal with validation logic
- Responsive dark UI

---

## 🧪 Testing Strategy

This project emphasizes test reliability and maintainability:

- **End-to-End Testing with Playwright**
- **Page Object Model (POM)** for scalable test structure
- **API Mocking** for deterministic test results
- **Behavior-based test separation** (data, search, error, interactions)
- **Data-testid selectors** for stable UI targeting
- **CI integration with GitHub Actions**
- **Automated HTML reports published via GitHub Pages**

---

## 🛠 Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query
- Recharts
- Playwright (E2E Testing)
- CoinCap API

---

## 📂 Project Structure

```
src/
├── app/
│   ├── api/coins/
│   │   ├── markets/        # CoinCap API proxy
│   │   └── [coinId]/
│   │       └── history/    # Historical data endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── Container.tsx       # Layout wrapper
└── features/crypto/
    ├── components/         # UI components
    ├── hooks/              # React hooks
    ├── api/                # API utilities
    ├── server/             # Server-side utilities
    └── types/              # TypeScript types

tests/
├── e2e/                    # End-to-end tests
│── pages/                  # Page Object Model
│── fixtures/               # Test setup
│── data/                   # Test data
└── utils/                  # Test utilities
```

### 🧪 Run Tests

```bash
npx playwright test
```

### 📊 Open Report

```bash
npx playwright show-report
```

---

## ⚙️ CI/CD

- GitHub Actions runs tests on every push/PR
- Playwright HTML reports are published automatically via GitHub Pages

---

## 📈 What This Project Demonstrates

- Building scalable frontend architecture
- Designing robust E2E testing strategies
- Handling real-world API data and failures
- Writing maintainable and reliable tests
- Integrating CI pipelines and reporting

## 📄 License

MIT