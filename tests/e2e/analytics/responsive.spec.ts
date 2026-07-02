import { expect, test, type Page } from "@playwright/test";

import {
  createQaAnalyticsFixtures,
  mockQaAnalyticsApi,
  type QaAnalyticsFixtures,
} from "./helpers";

async function mockSupabaseRoutes(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.includes("/test_runs")) {
      await route.fulfill({ json: fixtures.runs });
      return;
    }

    if (url.pathname.includes("/test_results")) {
      await route.fulfill({ json: fixtures.allResults });
      return;
    }

    await route.continue();
  });
}

async function mockWidgetApis(page: Page) {
  await page.route("**/api/quality-analytics/top-failures**", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            test_name: "Search by symbol finds the coin",
            suite: "dashboard/search.spec.ts",
            total_failures: 3,
            total_passes: 1,
            pass_rate: 25,
            branches_affected: ["main", "feature/analytics"],
            last_failed_at: "2026-05-25T10:00:00.000Z",
            latest_error: "Latest flaky selector broke again.",
          },
        ],
        days: 30,
      },
    });
  });

  await page.route("**/api/quality-analytics/flaky-tests**", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            test_name: "Search by symbol finds the coin",
            suite: "dashboard/search.spec.ts",
            total_failures: 2,
            total_passes: 2,
            pass_rate: 50,
          },
        ],
        days: 30,
      },
    });
  });

  await page.route("**/api/quality-analytics/failures-by-branch**", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            branch: "main",
            total_runs: 5,
            failed_runs: 1,
            passed_runs: 4,
            pass_rate: 80,
            unique_tests_failed: 2,
            last_run: "2026-05-25T10:00:00.000Z",
          },
        ],
        days: 30,
      },
    });
  });
}

test.describe("quality analytics mobile layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("metrics page fits within the mobile viewport", async ({ page }) => {
    const fixtures = createQaAnalyticsFixtures();

    await mockSupabaseRoutes(page, fixtures);
    await mockQaAnalyticsApi(page, fixtures);
    await mockWidgetApis(page);

    await page.goto("/quality-analytics");

    await expect(page.getByRole("heading", { name: "Metrics overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top failures" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Flaky tests" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Branch health" })).toBeVisible();
    await expect(page.getByTestId("test-trends-chart")).toBeVisible();
    await expect(
      page.getByTestId("top-failures-widget").getByText("Search by symbol finds the coin"),
    ).toBeVisible();
    await expect(page.getByTestId("flaky-tests-widget").getByText("Search by symbol finds the coin")).toBeVisible();
    await expect(page.getByTestId("branch-health-widget").getByText("main")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth > clientWidth + 1;
    });

    expect(overflow).toBeFalsy();
  });
});
