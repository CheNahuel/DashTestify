import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("dashboard renders with all 3 mocked coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.coinsList).toContainText("Bitcoin");
  await expect(dashboardPage.coinsList).toContainText("Ethereum");
  await expect(dashboardPage.coinsList).toContainText("Solana");
});

test("default selected asset is the highest market-cap coin", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // Bitcoin has the highest market_cap in testData (1T), so it is selected by default
  await dashboardPage.expectSelectedAsset("Bitcoin");
  await expect(dashboardPage.selectedAssetPrice).toContainText("$");
  await expect(dashboardPage.selectedAssetChange).toContainText("%");
});

test("default controls are market-cap sort and all-trend", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");
  await expect(dashboardPage.trendSelect).toHaveValue("all");
  await expect(dashboardPage.searchInput).toHaveValue("");
});

test("key UI panels are all visible on load", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.selectedAssetName).toBeVisible();
  await expect(dashboardPage.coinsList).toBeVisible();
  await expect(dashboardPage.journalInput).toBeVisible();
  await expect(dashboardPage.priceAlertSubmit).toBeVisible();
  await expect(dashboardPage.alertTable).toBeVisible();
});
