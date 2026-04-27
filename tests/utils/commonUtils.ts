import { expect, Page } from "@playwright/test";

export const initializeBrowserStorage = async (page: Page) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("__e2e_storage_initialized__")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__e2e_storage_initialized__", "true");
    }
  });
};

export const waitForDashboardData = async (page: Page) => {
  await page.waitForResponse("**/api/coins/markets*");
  await page.getByTestId("coin-card").first().waitFor();
};

export const waitForHistoryData = async (page: Page) => {
  await page.waitForResponse(/.*\/api\/coins\/.*\/history.*/);
};

export const expectUrlPath = async (page: Page, expectedPath: string) => {
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(expectedPath)}$`));
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
