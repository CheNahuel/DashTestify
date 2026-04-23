import { test as base } from "@playwright/test";
import testData from "../data/testData.json";
import { DashboardPage } from "../pages/DashboardPage";
import { initializeBrowserStorage, waitForDashboardData } from "../utils/commonUtils";

type DashboardFixture = (typeof testData)["dashboard"];

type AppFixtures = {
  dashboardPage: DashboardPage;
  dashboardData: DashboardFixture;
};

export const test = base.extend<AppFixtures>({
  dashboardData: async ({}, runFixture) => {
    await runFixture(testData.dashboard);
  },
  page: async ({ page }, runFixture, testInfo) => {
    await initializeBrowserStorage(page);

    if (testInfo.title.includes("market error")) {
      await runFixture(page);
      return;
    }

    await page.route("**/api/coins/markets*", async (route) => {
      await route.fulfill({ json: testData.dashboard.coins });
    });

    await page.route(/.*\/api\/coins\/.*\/history\?days=.*/, async (route) => {
      await route.fulfill({ json: testData.dashboard.history });
    });

    await runFixture(page);
  },
  dashboardPage: async ({ page }, runFixture) => {
    await runFixture(new DashboardPage(page));
  },
});

export { expect } from "@playwright/test";
export { waitForDashboardData };
