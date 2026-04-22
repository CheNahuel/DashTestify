import { test, expect } from "@playwright/test";

test("mocked coins API", async ({ page }) => {
  await page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({
      json: [
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
      ],
    });
  });

  await page.goto("http://localhost:3000");

  await expect(page.getByTestId("selected-asset-name")).toHaveText("Bitcoin");
  await expect(page.getByTestId("selected-asset-price")).toContainText("$");
});
