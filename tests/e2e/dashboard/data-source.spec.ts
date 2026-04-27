import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

// The fixture intercepts **/api/coins/markets* (matches both ?mock=1 and without),
// so both modes return test data in these tests. We verify URL and button state.
//
// Tests that require a clickable toggle are skipped automatically when no
// COINCAP_API_KEY is configured — in that case the button is always disabled
// (mock-only mode). They run in full when a key is present (live mode).

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

  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "true");
});

test("toggle shows 'Live data' when mockData param is absent", async ({ dashboardPage }) => {
  await dashboardPage.goto("/");
  await expect(dashboardPage.dataSourceToggle).toBeVisible();

  // Skip when no API key is configured — the button is disabled and always
  // shows "Mock" regardless of URL params.
  const isDisabled = await dashboardPage.dataSourceToggle.isDisabled();
  test.skip(isDisabled, "Requires COINCAP_API_KEY — toggle is disabled in mock-only mode");

  await expect(dashboardPage.dataSourceToggle).toHaveText("Live");
  await expect(dashboardPage.dataSourceToggle).toHaveAttribute("aria-pressed", "false");
});

test("clicking toggle from mock mode removes mockData param from URL", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home); // /?mockData=1
  await waitForDashboardData(dashboardPage.page);

  const isDisabled = await dashboardPage.dataSourceToggle.isDisabled();
  test.skip(isDisabled, "Requires COINCAP_API_KEY — toggle is disabled in mock-only mode");

  await dashboardPage.dataSourceToggle.click();

  await expect(dashboardPage.page).not.toHaveURL(/mockData=1/);
  await expect(dashboardPage.dataSourceToggle).toHaveText("Live");
});

test("clicking toggle from live mode adds mockData=1 to URL", async ({ dashboardPage }) => {
  await dashboardPage.goto("/");
  await expect(dashboardPage.dataSourceToggle).toBeVisible();

  const isDisabled = await dashboardPage.dataSourceToggle.isDisabled();
  test.skip(isDisabled, "Requires COINCAP_API_KEY — toggle is disabled in mock-only mode");

  await dashboardPage.dataSourceToggle.click();

  await expect(dashboardPage.page).toHaveURL(/mockData=1/);
  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock");
});

test("toggle preserves other URL params when switching modes", async ({ dashboardPage }) => {
  await dashboardPage.goto(
    "/?mockData=1&selectedCoin=bitcoin&sort=price-desc&trend=gainers&days=30",
  );
  await waitForDashboardData(dashboardPage.page);

  const isDisabled = await dashboardPage.dataSourceToggle.isDisabled();
  test.skip(isDisabled, "Requires COINCAP_API_KEY — toggle is disabled in mock-only mode");

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

  const isDisabled = await dashboardPage.dataSourceToggle.isDisabled();
  test.skip(isDisabled, "Requires COINCAP_API_KEY — toggle is disabled in mock-only mode");

  await dashboardPage.dataSourceToggle.click();
  await expect(dashboardPage.dataSourceToggle).toHaveText("Live");

  await dashboardPage.dataSourceToggle.click();
  await expect(dashboardPage.dataSourceToggle).toHaveText("Mock");
  await expect(dashboardPage.page).toHaveURL(/mockData=1/);
});
