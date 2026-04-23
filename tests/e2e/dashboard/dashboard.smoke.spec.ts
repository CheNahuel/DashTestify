import { expect, test, waitForDashboardData } from "../../fixtures/testSetup";

test("mocked coins API", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectSelectedAsset("Ethereum");
  await expect(dashboardPage.selectedAssetPrice).toContainText("$");
  await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");
  await expect(dashboardPage.coinsList).toContainText("Solana");
});
