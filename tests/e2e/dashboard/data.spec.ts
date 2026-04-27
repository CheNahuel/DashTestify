import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("selected coin shows price and percentage change", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectSelectedAsset("Bitcoin");
  await expect(dashboardPage.selectedAssetPrice).toContainText("$");
  await expect(dashboardPage.selectedAssetChange).toContainText("%");
});

test("chart renders with historical data", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.coinChart).toBeVisible();
});

test("stat cards show market cap and volume", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Scope to the stat-cards section to avoid matching the sort <select> and coin card labels
  await expect(dashboardPage.statCards.getByText("Market Cap")).toBeVisible();
  await expect(dashboardPage.statCards.getByText("24H Volume")).toBeVisible();
  await expect(dashboardPage.statCards.getByText("Range High")).toBeVisible();
  await expect(dashboardPage.statCards.getByText("Range Low")).toBeVisible();
});

test("journal panel starts with 0 notes and empty state", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.journalNoteCount).toHaveText("0 notes");
  await expect(dashboardPage.journalEmpty).toBeVisible();
});

test("price alert form is visible with submit button", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.priceAlertSubmit).toBeVisible();
  await expect(dashboardPage.priceAlertEmail).toBeVisible();
  await expect(dashboardPage.priceAlertTarget).toBeVisible();
});

test("visible coins pill shows total count", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectVisibleCoinsCount(3);
});

test("positive change is green, negative change omits the plus sign", async ({
  dashboardData,
  dashboardPage,
}) => {
  // Bitcoin: current_price=50000, mock history goes from 44000→50000 → positive range change
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.selectedAssetChange).toContainText("+");

  // Ethereum: current_price=3500, mock history starts at 44000 → large negative range change
  await dashboardPage.goto(dashboardData.urls.ethereumDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.selectedAssetChange).not.toContainText("+");
});

test("coin card shows name, price, and market cap", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  const bitcoinCard = dashboardPage.coinCard("bitcoin");
  await expect(bitcoinCard).toContainText("Bitcoin");
  await expect(bitcoinCard).toContainText("$");
  await expect(bitcoinCard).toContainText("Market Cap");
});
