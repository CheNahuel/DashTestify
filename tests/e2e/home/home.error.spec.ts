import { test, expect } from "@playwright/test";

test("handles API error", async ({ page }) => {
  await page.goto("http://localhost:3000/?marketUnavailable=1");

  await expect(page.getByTestId("market-error-banner")).toBeVisible();
});
