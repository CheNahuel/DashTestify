# Crypto Intelligence Dashboard

A modern, responsive cryptocurrency tracking dashboard built with Next.js 16, featuring real-time price data, interactive charts, and comprehensive end-to-end testing.

## Features

- **Real-time Crypto Data**: Live price tracking from CoinCap API
- **Interactive Charts**: Historical price visualization with multiple time ranges (24H, 7D, 30D, 90D)
- **Smart Search**: Filter cryptocurrencies by name or symbol
- **Market Overview**: Top coins snapshot with market cap and volume data
- **Responsive Design**: Optimized for desktop and mobile devices
- **Dark Theme**: Modern UI with Tailwind CSS styling

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **Testing**: Playwright (E2E)
- **API**: CoinCap API
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd DashTestify1
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing

### End-to-End Tests

Run the complete test suite:
```bash
npm run test:e2e
```

Run tests with UI mode:
```bash
npm run test:e2e:ui
```

View test reports:
```bash
npm run test:e2e:report
```

### Test Coverage

The test suite covers:
- **Data Display**: Coin price and percentage rendering
- **Search Functionality**: Filtering and no-match states
- **API Error Handling**: Network failure scenarios
- **Query Parameters**: URL-based state management
- **Chart Interactions**: Time range selection
- **Mocked APIs**: Deterministic test data

## Project Structure

```
├── app/
│   ├── api/coins/markets/     # CoinCap API proxy
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/
│   ├── Container.tsx         # Layout wrapper
│   └── features/crypto/      # Crypto-specific components
│       ├── components/       # UI components
│       ├── hooks/           # React hooks
│       ├── server/          # Server-side utilities
│       └── types/           # TypeScript types
├── lib/
│   └── api-client.ts        # Axios configuration
├── tests/
│   └── e2e/                 # End-to-end tests
│       └── home/            # Home page tests
├── test-results/            # Playwright reports
└── playwright.config.ts     # Playwright configuration
```

## API Integration

The dashboard integrates with the [CoinCap API](https://docs.coincap.io/) to fetch:
- Top cryptocurrencies by market cap
- Real-time price data
- Historical price charts
- Market statistics

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:e2e` - Run e2e tests
- `npm run test:e2e:ui` - Run tests with UI
- `npm run test:e2e:report` - View test reports

### Environment Variables

No environment variables are required. The app uses the public CoinCap API.

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Deploy automatically on push to main branch
3. The app is optimized for Vercel's edge runtime

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [CoinCap API](https://coincap.io/) for cryptocurrency data
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Playwright](https://playwright.dev/) for testing
