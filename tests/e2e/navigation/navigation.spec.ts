import { expect, test } from "@playwright/test";
import testData from "@tests/data/testData.json";
import { DashboardPage } from "@tests/pages/DashboardPage";
import { MetricsPage } from "@tests/pages/MetricsPage";
import { initializeBrowserStorage, waitForDashboardData } from "@tests/utils/commonUtils";

test.describe("Navigation between Home and Metrics", () => {
  test.beforeEach(async ({ page }) => {
    await initializeBrowserStorage(page);

    await page.route("**/api/coins/markets*", async (route) => {
      await route.fulfill({ json: testData.dashboard.coins });
    });

    await page.route(/.*\/api\/coins\/.*\/history\?interval=.*&start=.*&end=.*/, async (route) => {
      await route.fulfill({ json: testData.dashboard.history });
    });
  });

  test("Quality Analytics link appears in top navigation", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto("/?mockData=1");
    await waitForDashboardData(page);

    const qualityAnalyticsLink = page.getByRole("link", { name: /Quality Analytics/i });
    await expect(qualityAnalyticsLink).toBeVisible();
  });

  test("Clicking Quality Analytics navigates to metrics page", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto("/?mockData=1");
    await waitForDashboardData(page);

    const qualityAnalyticsLink = page.getByRole("link", { name: /Quality Analytics/i });
    await qualityAnalyticsLink.click();

    await page.waitForURL(/.*\/quality-analytics/);
    expect(page.url()).toContain("/quality-analytics");
  });

  test("Refresh button is visible on metrics page", async ({ page }) => {
    const metricsPage = new MetricsPage(page);
    await metricsPage.goto("/quality-analytics");

    await metricsPage.expectRefreshButtonVisible();
    await expect(metricsPage.refreshButton).toBeVisible();
  });

  test("Full navigation flow: Home -> Quality Analytics -> Home", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.goto("/?mockData=1");
    await waitForDashboardData(page);
    expect(page.url()).toContain("/");

    const qualityAnalyticsLink = page.getByRole("link", { name: /Quality Analytics/i });
    await qualityAnalyticsLink.click();
    await page.waitForURL(/.*\/quality-analytics/);
    expect(page.url()).toContain("/quality-analytics");

    const cryptoDashboardLink = page.getByRole("link", { name: /Crypto Dashboard/i });
    await cryptoDashboardLink.click();
    await page.waitForURL(/.*\/$/);
    expect(page.url()).toContain("/");
  });
});

test.describe("Refresh functionality on Metrics page", () => {
  test("Refresh button loads the latest metrics data", async ({ page }) => {
    const metricsPage = new MetricsPage(page);
    await metricsPage.goto("/quality-analytics");

    await metricsPage.expectStatsVisible();
    const initialTotalRuns = await metricsPage.statsTotalRuns.textContent();

    await metricsPage.clickRefresh();
    await metricsPage.expectRefreshButtonDisabled();
    await metricsPage.waitForRefreshToComplete();
    await metricsPage.expectRefreshButtonEnabled();

    const updatedTotalRuns = await metricsPage.statsTotalRuns.textContent();
    expect(initialTotalRuns).toBeDefined();
    expect(updatedTotalRuns).toBeDefined();
  });

  test("Refresh button shows loading state while fetching", async ({ page }) => {
    const metricsPage = new MetricsPage(page);
    await metricsPage.goto("/quality-analytics");

    const refreshButton = metricsPage.refreshButton;
    await expect(refreshButton).toBeEnabled();

    await refreshButton.click();
    await metricsPage.expectRefreshButtonDisabled();

    await metricsPage.waitForRefreshToComplete();
    await expect(refreshButton).toBeEnabled();
  });
});
