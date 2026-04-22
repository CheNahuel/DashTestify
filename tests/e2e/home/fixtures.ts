import { Page } from "@playwright/test";

export const coinsMock = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "btc",
    current_price: 50000,
    price_change_percentage_24h: 5,
    image: "https://assets.coincap.io/assets/icons/btc@2x.png",
    market_cap: 1000000000,
    total_volume: 50000000,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "eth",
    current_price: 3500,
    price_change_percentage_24h: -1.2,
    image: "https://assets.coincap.io/assets/icons/eth@2x.png",
    market_cap: 420000000000,
    total_volume: 22000000000,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "sol",
    current_price: 180,
    price_change_percentage_24h: 12.4,
    image: "https://assets.coincap.io/assets/icons/sol@2x.png",
    market_cap: 81000000000,
    total_volume: 4100000000,
  },
];

export const historyMock = {
  prices: [
    [1713700000000, 44000],
    [1713786400000, 46000],
    [1713872800000, 48000],
    [1713959200000, 50000],
  ],
};

export const setupDashboardRoutes = async (page: Page) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("__e2e_storage_initialized__")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__e2e_storage_initialized__", "true");
    }
  });

  await page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({ json: coinsMock });
  });

  await page.route(/.*\/api\/coins\/.*\/history\?days=.*/, async (route) => {
    await route.fulfill({ json: historyMock });
  });
};
