import { test, expect } from "@playwright/test";
import { setupDashboardRoutes, waitForDashboardData } from "./fixtures";

test("search filters coins", async ({ page }) => {
  await setupDashboardRoutes(page);

  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  const searchInput = page.getByTestId("search-input");

  await searchInput.fill("sol");

  await expect(page.getByTestId("selected-asset-name")).toHaveText("Solana");
  await expect(page.getByTestId("coins-list")).toContainText("Solana");
  await expect(page).toHaveURL(/search=sol/);
});

test("query params preselect coin, search, range, and trend", async ({ page }) => {
  await setupDashboardRoutes(page);

  await page.goto(
    "/?mockData=1&selectedCoin=solana&sort=market-cap-desc&trend=gainers&days=30&search=sol"
  );
  await waitForDashboardData(page);

  await expect(page.getByTestId("search-input")).toHaveValue("sol");
  await expect(page.getByTestId("selected-asset-name")).toHaveText("Solana");
  await expect(page.getByTestId("range-button-30")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("trend-select")).toHaveValue("gainers");
});

test("displays no match message when search returns nothing", async ({ page }) => {
  await setupDashboardRoutes(page);

  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  const searchInput = page.getByTestId("search-input");

  await searchInput.fill("ghost-coin-12345");

  await expect(page.getByTestId("no-match-message")).toBeVisible();
});
