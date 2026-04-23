import { expect, test, waitForDashboardData } from "../../fixtures/testSetup";

test("search filters coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("sol");

  await dashboardPage.expectSelectedAsset("Solana");
  await expect(dashboardPage.coinsList).toContainText("Solana");
  await expect(dashboardPage.page).toHaveURL(/search=sol/);
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
});
