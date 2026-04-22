import { test, expect } from "@playwright/test";

const coinsMock = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "btc",
    current_price: 50000,
    price_change_percentage_24h: 5,
    image: "test.png",
    market_cap: 1000000000,
    total_volume: 50000000,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "eth",
    current_price: 3500,
    price_change_percentage_24h: -1.2,
    image: "test.png",
    market_cap: 420000000000,
    total_volume: 22000000000,
  },
];

test("search filters coins", async ({ page }) => {
  await page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({ json: coinsMock });
  });

  await page.goto("http://localhost:3000");

  const searchInput = page.getByTestId("search-input");

  await searchInput.fill("bitcoin");

  await expect(page.getByTestId("selected-asset-name")).toHaveText("Bitcoin");
  await expect(page.getByTestId("coins-list")).toContainText("Bitcoin");
});

test("query params preselect coin, search, and range", async ({ page }) => {
  await page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({ json: coinsMock });
  });

  await page.goto("http://localhost:3000/?selectedCoin=ethereum&search=eth&days=30");

  await expect(page.getByTestId("search-input")).toHaveValue("eth");
  await expect(page.getByTestId("selected-asset-name")).toHaveText("Ethereum");
  await expect(page.getByTestId("range-button-30")).toHaveAttribute("aria-pressed", "true");
});

test("displays no match message when search returns nothing", async ({ page }) => {
  await page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({ json: coinsMock });
  });

  await page.goto("http://localhost:3000");

  const searchInput = page.getByTestId("search-input");

  await searchInput.fill("ghost-coin-12345");

  await expect(page.getByTestId("no-match-message")).toBeVisible();
});
