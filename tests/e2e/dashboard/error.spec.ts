import { expect, test } from "@tests/fixtures/testSetup";
import { waitForDashboardData } from "@tests/utils/commonUtils";

test("handles market error", async ({ dashboardPage }) => {
  await dashboardPage.goto("/?marketUnavailable=1");

  await expect(dashboardPage.marketErrorBanner).toBeVisible();
});

test("market error banner contains rate-limit hint", async ({ dashboardPage }) => {
  await dashboardPage.goto("/?marketUnavailable=1");

  await expect(dashboardPage.marketErrorBanner).toContainText("CoinCap");
});

test("shows market error banner and still renders coin list", async ({ dashboardData, dashboardPage }) => {
  // The marketUnavailable flag shows the banner but the mocked coins are
  // still returned by the client-side route, so the list should still render.
  await dashboardPage.goto("/?mockData=1&marketUnavailable=1");
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.marketErrorBanner).toBeVisible();
  await expect(dashboardPage.coinsList).toBeVisible();
});

test("history error shows inline error message in chart area", async ({
  dashboardData,
  dashboardPage,
}) => {
  // Override the history route to return a 500 error for this test
  await dashboardPage.page.route(/.*\/api\/coins\/.*\/history.*/, async (route) => {
    await route.fulfill({ status: 500, json: { message: "Unable to load historical data." } });
  });

  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.page.getByText("Unable to load historical data.")).toBeVisible();
});

test("coins market API 429 shows error banner", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.page.route("**/api/coins/markets*", async (route) => {
    await route.fulfill({
      status: 429,
      json: { message: "CoinCap rate limit reached. Please wait a moment and try again." },
    });
  });

  await dashboardPage.goto(dashboardData.urls.home);

  await expect(dashboardPage.marketErrorBanner).toBeVisible();
});
