import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("loads without horizontal overflow and search remains usable", async ({
    dashboardData,
    dashboardPage,
  }) => {
    await dashboardPage.goto(dashboardData.urls.home);
    await waitForDashboardData(dashboardPage.page);

    await dashboardPage.searchInput.click();
    await expect(dashboardPage.searchDropdown).toBeVisible();

    const overflow = await dashboardPage.page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth > clientWidth + 1;
    });

    expect(overflow).toBeFalsy();
  });

  test("selected dashboard fits within the mobile viewport", async ({
    dashboardData,
    dashboardPage,
  }) => {
    await dashboardPage.goto(dashboardData.urls.home);
    await waitForDashboardData(dashboardPage.page);

    await dashboardPage.searchFor("eth");
    await dashboardPage.selectSearchResult("ethereum");

    await dashboardPage.expectMainDashboardVisible();
    await expect(dashboardPage.selectedAssetName).toBeVisible();

    const overflow = await dashboardPage.page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth > clientWidth + 1;
    });

    expect(overflow).toBeFalsy();
  });
});

test.describe("tablet layout", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("top coins and search controls stay within bounds", async ({
    dashboardData,
    dashboardPage,
  }) => {
    await dashboardPage.goto(dashboardData.urls.home);
    await waitForDashboardData(dashboardPage.page);

    const overflow = await dashboardPage.page.evaluate(() => {
      const { scrollWidth, clientWidth } = document.documentElement;
      return scrollWidth > clientWidth + 1;
    });

    expect(overflow).toBeFalsy();
  });
});
