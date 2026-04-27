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
  await dashboardPage.goto(dashboardData.urls.home); // /?mockData=1
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock data");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "true");
});

test("toggle shows 'Live data' when mockData param is absent", async ({ dashboardPage }) => {
  // SSR serves real data when no mockData param — wait for the button directly.
  await dashboardPage.goto("/");
  await expect(dashboardPage.dataSourceToggle).toBeVisible();

  await expect(dashboardPage.dataSourceToggle).toHaveText("Live data");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "false");
});

test("clicking toggle from mock mode removes mockData param from URL", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home); // /?mockData=1
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.dataSourceToggle.click();

  await expect(dashboardPage.page).not.toHaveURL(/mockData=1/);
  await expect(dashboardPage.dataSourceToggle).toHaveText("Live data");
});

test("clicking toggle from live mode adds mockData=1 to URL", async ({ dashboardPage }) => {
  // SSR serves real data — wait for the button, then toggle.
  await dashboardPage.goto("/");
  await expect(dashboardPage.dataSourceToggle).toBeVisible();

  await dashboardPage.dataSourceToggle.click();

  await expect(dashboardPage.page).toHaveURL(/mockData=1/);
  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock data");
});

test("toggle preserves other URL params when switching modes", async ({ dashboardPage }) => {
  // Start with mockData + extra params
  await dashboardPage.goto(
    "/?mockData=1&selectedCoin=bitcoin&sort=price-desc&trend=gainers&days=30",
  );
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.dataSourceToggle.click();

  // mockData should be gone, but other params should survive
  await expect(dashboardPage.page).not.toHaveURL(/mockData=1/);
  await expect(dashboardPage.page).toHaveURL(/sort=price-desc/);
  await expect(dashboardPage.page).toHaveURL(/trend=gainers/);
  await expect(dashboardPage.page).toHaveURL(/days=30/);
});

test("toggling back and forth stabilises on the last mode", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.dataSourceToggle.click();
  await expect(dashboardPage.dataSourceToggle).toHaveText("Live data");

  await dashboardPage.dataSourceToggle.click();
  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock data");
  await expect(dashboardPage.page).toHaveURL(/mockData=1/);
});
