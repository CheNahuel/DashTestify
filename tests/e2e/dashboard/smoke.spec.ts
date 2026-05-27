import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("dashboard renders with all 3 mocked coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.coinsList).toContainText("Bitcoin");
  await expect(dashboardPage.coinsList).toContainText("Ethereum");
  await expect(dashboardPage.coinsList).toContainText("Solana");
});

test("initial load shows top coins and hides the main dashboard", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectTopCoinsVisible();
  await dashboardPage.expectMainDashboardHidden();
  await expect(dashboardPage.searchInput).toHaveValue("");
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

test("key UI panels for selected coin appear after selection", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.selectedAssetName).toBeVisible();
  await expect(dashboardPage.selectedAssetPrice).toBeVisible();
  await expect(dashboardPage.journalInput).toBeVisible();
  await expect(dashboardPage.priceAlertSubmit).toBeVisible();
  await expect(dashboardPage.alertTable).toBeVisible();
});
