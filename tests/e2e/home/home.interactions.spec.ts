import { test, expect } from "@playwright/test";
import { setupDashboardRoutes, waitForDashboardData } from "./fixtures";

test("sorts gainers and syncs controls into the URL", async ({ page }) => {
  await setupDashboardRoutes(page);
  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  await page.getByTestId("trend-select").selectOption("gainers");
  await page.getByTestId("sort-select").selectOption("change-desc");

  const firstCard = page.locator('[data-testid="coin-card"]').first();

  await expect(firstCard).toContainText("Solana");
  await expect(page).toHaveURL(/trend=gainers/);
  await expect(page).toHaveURL(/sort=change-desc/);
});

test("watchlist survives a reload and can be filtered", async ({ page }) => {
  await setupDashboardRoutes(page);
  await page.goto("/?mockData=1");
  await waitForDashboardData(page);

  await page.getByTestId("favorite-toggle-solana").click();
  await expect(page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  await page.reload();

  await expect(page.getByTestId("favorite-toggle-solana")).toContainText("Saved");
  await page.getByTestId("favorites-filter").click();

  await expect(page.locator('[data-testid="coin-card"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="coin-card"]').first()).toContainText("Solana");
});

test("journal notes validate, persist, and can be deleted", async ({ page }) => {
  await setupDashboardRoutes(page);
  await page.goto("/?mockData=1&selectedCoin=bitcoin&sort=market-cap-desc&trend=all&days=7");
  await waitForDashboardData(page);

  await page.getByTestId("journal-input").fill("Too short");
  await page.getByTestId("journal-submit").click();
  await expect(page.getByTestId("journal-error")).toContainText("at least 10 characters");

  await page
    .getByTestId("journal-input")
    .fill("Watching the breakout level and waiting for higher volume confirmation.");
  await page.getByTestId("journal-submit").click();

  await expect(page.getByTestId("journal-note-count")).toHaveText("1 note");
  await expect(page.getByTestId("journal-entries")).toContainText("breakout level");

  await page.reload();

  await expect(page.getByTestId("journal-entries")).toContainText("breakout level");
  await page.locator('[data-testid^="delete-note-"]').first().click();
  await expect(page.getByTestId("journal-empty")).toBeVisible();
});

test("price alert form handles validation and success", async ({ page }) => {
  await setupDashboardRoutes(page);
  await page.goto("/?mockData=1&selectedCoin=bitcoin&sort=market-cap-desc&trend=all&days=7");
  await waitForDashboardData(page);

  await page.getByTestId("price-alert-email").fill("trader@example.com");
  await page.getByTestId("price-alert-target").fill("50000");
  await page.getByTestId("price-alert-submit").click();

  await expect(page.getByTestId("price-alert-target-error")).toContainText(
    "meaningfully different"
  );

  await page.getByTestId("price-alert-email").fill("trader@example.com");
  await page.getByTestId("price-alert-target").fill("55000");
  await page.getByTestId("price-alert-submit").click();

  await expect(page.getByTestId("price-alert-message")).toContainText(
    "Alert saved for Bitcoin"
  );
});
