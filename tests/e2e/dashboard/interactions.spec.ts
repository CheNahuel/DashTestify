import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";
import { expectUrlPath } from "@tests/utils/commonUtils";

test("sorts gainers and syncs controls into the URL", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectTrend("gainers");
  await dashboardPage.selectSort("change-desc");

  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana"
  );
  await expect(dashboardPage.page).toHaveURL(/trend=gainers/);
  await expect(dashboardPage.page).toHaveURL(/sort=change-desc/);
});

test("reset dashboard returns filters to the default home state", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(
    "/?mockData=1&selectedCoin=solana&sort=change-desc&trend=gainers&days=30&search=sol"
  );
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.favoritesFilter.click();
  await expect(dashboardPage.favoritesFilter).toHaveAttribute("aria-pressed", "true");

  await dashboardPage.resetButton.click();

  await expect(dashboardPage.searchInput).toHaveValue("");
  await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");
  await expect(dashboardPage.trendSelect).toHaveValue("all");
  await dashboardPage.expectRangeSelected(7);
  await expect(dashboardPage.favoritesFilter).toHaveAttribute("aria-pressed", "false");
  await expectUrlPath(dashboardPage.page, dashboardData.urls.resetResult);
});

test("watchlist survives a reload and can be filtered", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  await dashboardPage.page.reload();

  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");
  await dashboardPage.favoritesFilter.click();

  await expect(dashboardPage.page.locator('[data-testid="coin-card"]')).toHaveCount(1);
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana"
  );
});

test("journal notes validate, persist, and can be deleted", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.journalInput.fill("Too short");
  await dashboardPage.journalSubmit.click();
  await expect(dashboardPage.journalError).toContainText("at least 10 characters");

  await dashboardPage.journalInput.fill(
    "Watching the breakout level and waiting for higher volume confirmation."
  );
  await dashboardPage.journalSubmit.click();

  await expect(dashboardPage.journalNoteCount).toHaveText("1 note");
  await expect(dashboardPage.journalEntries).toContainText("breakout level");

  await dashboardPage.page.reload();

  await expect(dashboardPage.journalEntries).toContainText("breakout level");
  await dashboardPage.page.locator('[data-testid^="delete-note-"]').first().click();
  await expect(dashboardPage.journalEmpty).toBeVisible();
});

test("price alert form handles validation and success", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("50000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertTargetError).toContainText("meaningfully different");

  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("55000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertMessage).toContainText("Alert saved for Bitcoin");
});
