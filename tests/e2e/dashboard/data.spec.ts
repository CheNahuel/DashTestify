import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("coin shows price and percentage", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectSelectedAsset("Ethereum");
  await expect(dashboardPage.selectedAssetPrice).toContainText("$");
  await expect(dashboardPage.selectedAssetChange).toContainText("%");
  await expect(dashboardPage.journalNoteCount).toHaveText("0 notes");
  await expect(dashboardPage.priceAlertSubmit).toBeVisible();
});
