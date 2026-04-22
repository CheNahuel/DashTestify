import { test, expect } from "@playwright/test";
import { setupDashboardRoutes, waitForDashboardData } from "./fixtures";

test("mocked coins API", async ({ page }) => {
  await setupDashboardRoutes(page);

  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  await expect(page.getByTestId("selected-asset-name")).toHaveText("Ethereum");
  await expect(page.getByTestId("selected-asset-price")).toContainText("$");
  await expect(page.getByTestId("sort-select")).toHaveValue("market-cap-desc");
  await expect(page.getByTestId("coins-list")).toContainText("Solana");
});
