import { test, expect } from "@playwright/test";
import { setupDashboardRoutes, waitForDashboardData } from "./fixtures";

test("coin shows price and percentage", async ({ page }) => {
  await setupDashboardRoutes(page);

  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  await expect(page.getByTestId("selected-asset-name")).toHaveText("Ethereum");
  await expect(page.getByTestId("selected-asset-price")).toContainText("$");
  await expect(page.getByTestId("selected-asset-change")).toContainText("%");
  await expect(page.getByTestId("journal-note-count")).toHaveText("0 notes");
  await expect(page.getByTestId("price-alert-submit")).toBeVisible();
});
