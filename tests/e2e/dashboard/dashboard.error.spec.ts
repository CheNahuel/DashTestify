import { expect, test } from "../../fixtures/testSetup";

test("handles market error", async ({ dashboardPage }) => {
  await dashboardPage.goto("/?marketUnavailable=1");

  await expect(dashboardPage.marketErrorBanner).toBeVisible();
});
