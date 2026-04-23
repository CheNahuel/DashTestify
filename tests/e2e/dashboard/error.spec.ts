import { expect, test } from "@tests/fixtures/testSetup";

test("handles market error", async ({ dashboardPage }) => {
  await dashboardPage.goto("/?marketUnavailable=1");

  await expect(dashboardPage.marketErrorBanner).toBeVisible();
});
