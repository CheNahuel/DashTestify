import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

// The fixture intercepts **/api/coins/markets* (matches both ?mock=1 and without),
// so both modes return test data in these tests. We verify URL and button state.

test("data source toggle is visible", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.dataSourceToggle).toBeVisible();
});

test("toggle shows 'Mock data' when mockData=1 is in URL", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "true");
});

test("mock mode preserves dashboard params on load", async ({ dashboardPage }) => {
  await dashboardPage.goto(
    "/?mockData=1&selectedCoin=bitcoin&sort=price-desc&trend=gainers&timeframe=30D",
  );
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "true");
  await expect(dashboardPage.page).toHaveURL(/mockData=1/);
  await expect(dashboardPage.page).toHaveURL(/sort=price-desc/);
  await expect(dashboardPage.page).toHaveURL(/trend=gainers/);
  await expect(dashboardPage.page).toHaveURL(/timeframe=30D/);
});
