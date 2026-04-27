import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("search by name filters coins and selects match", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("sol");

  await dashboardPage.expectSelectedAsset("Solana");
  await expect(dashboardPage.coinsList).toContainText("Solana");
  await expect(dashboardPage.coinsList).not.toContainText("Bitcoin");
  await expect(dashboardPage.page).toHaveURL(/search=sol/);
});

test("search by symbol finds the coin", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("BTC");

  await expect(dashboardPage.coinsList).toContainText("Bitcoin");
  await expect(dashboardPage.coinsList).not.toContainText("Ethereum");
  await expect(dashboardPage.coinsList).not.toContainText("Solana");
});

test("search is case-insensitive", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("ETHEREUM");

  await expect(dashboardPage.coinsList).toContainText("Ethereum");
  await expect(dashboardPage.coinsList).not.toContainText("Bitcoin");
});

test("search updates visible coins pill count", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectVisibleCoinsCount(3);

  await dashboardPage.searchFor("sol");

  await dashboardPage.expectVisibleCoinsCount(1);
});

test("query params preselect coin, search, range, and trend", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.solanaFiltered);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.searchInput).toHaveValue("sol");
  await dashboardPage.expectSelectedAsset("Solana");
  await dashboardPage.expectRangeSelected(30);
  await expect(dashboardPage.trendSelect).toHaveValue("gainers");
});

test("displays no match message when search returns nothing", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("ghost-coin-12345");

  await expect(dashboardPage.noMatchMessage).toBeVisible();
  await dashboardPage.expectVisibleCoinsCount(0);
});

test("clearing search restores all coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("bitcoin");
  await dashboardPage.expectVisibleCoinsCount(1);

  await dashboardPage.searchFor("");
  await dashboardPage.expectVisibleCoinsCount(3);
});

test("search combined with trend reduces results correctly", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // "sol" matches only Solana; Solana is a gainer — should show 1
  await dashboardPage.searchFor("sol");
  await dashboardPage.selectTrend("gainers");

  await dashboardPage.expectVisibleCoinsCount(1);
  await expect(dashboardPage.coinsList).toContainText("Solana");

  // Switch to losers — Solana is not a loser, so 0 results
  await dashboardPage.selectTrend("losers");
  await expect(dashboardPage.noMatchMessage).toBeVisible();
  await dashboardPage.expectVisibleCoinsCount(0);
});
