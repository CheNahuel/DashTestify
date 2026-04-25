# Crypto Intelligence Dashboard (Next.js + Playwright E2E Testing)

A modern cryptocurrency dashboard built with Next.js, showcasing real-time data visualization and a production-like end-to-end testing setup using Playwright.

---

## 🌐 Live Demo

👉 https://dash-testify.vercel.app/

## 🧪 Test Report (Playwright)

👉 https://chenahuel.github.io/DashTestify/

## 🚀 Features

- Real-time crypto data from CoinCap API
- Interactive historical charts (24H, 7D, 30D, 90D)
- Smart search and filtering
- Market overview dashboard
- Trade journal with validation logic
- Responsive dark UI

## 🎯 Why Playwright

This project was built to explore modern end-to-end testing approaches using Playwright, focusing on reliability, speed, and maintainability compared to traditional frameworks.

## 🧪 Testing Strategy

This project emphasizes test reliability and maintainability:

- **End-to-End Testing with Playwright**
- **Page Object Model (POM)** for scalable test structure
- **API Mocking** for deterministic test results
- **Behavior-based test separation** (data, search, error, interactions)
- **Data-testid selectors** for stable UI targeting
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
- CoinCap API

### 📂 Project Structure

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

### ▶️ Run Application

```bash
npm install
npm run dev
```

### 🧪 Run Tests

```bash
npm run test:e2e
```

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
