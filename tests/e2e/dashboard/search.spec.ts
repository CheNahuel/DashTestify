import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test("autocomplete filters coins by name while typing", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("bit");

  await expect(dashboardPage.searchDropdown).toBeVisible();
  await expect(dashboardPage.searchDropdown).toContainText("Bitcoin");
  await expect(dashboardPage.searchDropdown).not.toContainText("Ethereum");
  await expect(dashboardPage.searchDropdown).not.toContainText("Solana");
});

test("autocomplete filters coins by symbol while typing", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("eth");

  await expect(dashboardPage.searchDropdown).toBeVisible();
  await expect(dashboardPage.searchDropdown).toContainText("Ethereum");
  await expect(dashboardPage.searchDropdown).toContainText("ETH");
});

test("search dropdown closes when clicking outside", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("sol");
  await expect(dashboardPage.searchDropdown).toBeVisible();

  await dashboardPage.page.mouse.click(10, 10);

  await expect(dashboardPage.searchDropdown).toBeHidden();
});

test("selecting a coin from autocomplete shows the main dashboard and hides top coins", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("sol");
  await dashboardPage.selectSearchResult("solana");

  await dashboardPage.expectMainDashboardVisible();
  await expect(dashboardPage.searchInput).toHaveValue("Solana (SOL)");
  await expect(dashboardPage.topCoinsPanel).toHaveCount(0);
  await dashboardPage.expectSelectedAsset("Solana");
  await expect(dashboardPage.page).toHaveURL(/selectedCoin=solana/);
});

test("clicking the selected coin input starts a fresh search", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.searchFor("bit");
  await dashboardPage.selectSearchResult("bitcoin");
  await dashboardPage.expectMainDashboardVisible();

  await dashboardPage.searchInput.click();

  await dashboardPage.expectTopCoinsVisible();
  await dashboardPage.expectMainDashboardHidden();
  await expect(dashboardPage.searchInput).toHaveValue("");
  await expect(dashboardPage.searchDropdown).toBeVisible();
  await expect(dashboardPage.searchDropdown).toContainText("Bitcoin");
  await expect(dashboardPage.searchDropdown).toContainText("Ethereum");
  await expect(dashboardPage.searchDropdown).toContainText("Solana");
  await expect(dashboardPage.page).not.toHaveURL(/selectedCoin=/);
});
