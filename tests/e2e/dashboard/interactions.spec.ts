import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";
import { expectUrlPath } from "@tests/utils/commonUtils";

test("sorts gainers and syncs controls into the URL", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectTrend("gainers");
  await dashboardPage.selectSort("change-desc");

  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana",
  );
  await expect(dashboardPage.page).toHaveURL(/trend=gainers/);
  await expect(dashboardPage.page).toHaveURL(/sort=change-desc/);
});

test("reset dashboard returns filters to the default home state", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(
    "/?mockData=1&selectedCoin=solana&sort=change-desc&trend=gainers&days=30&search=sol",
  );
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.favoritesFilter.click();
  await expect(dashboardPage.favoritesFilter).toHaveAttribute("aria-pressed", "true");

  await dashboardPage.resetButton.click();

  await expect(dashboardPage.searchInput).toHaveValue("");
  await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");
  await expect(dashboardPage.trendSelect).toHaveValue("all");
  await dashboardPage.expectRangeSelected(7);
  await expect(dashboardPage.favoritesFilter).toHaveAttribute("aria-pressed", "false");
  await expectUrlPath(dashboardPage.page, dashboardData.urls.resetResult);
});

test("watchlist survives a reload and can be filtered", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  await dashboardPage.page.reload();

  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");
  await dashboardPage.favoritesFilter.click();

  await expect(dashboardPage.page.locator('[data-testid="coin-card"]')).toHaveCount(1);
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana",
  );
});

test("journal notes validate, persist, and can be deleted", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.journalInput.fill("Too short");
  await dashboardPage.journalSubmit.click();
  await expect(dashboardPage.journalError).toContainText("at least 10 characters");

  await dashboardPage.journalInput.fill(
    "Watching the breakout level and waiting for higher volume confirmation.",
  );
  await dashboardPage.journalSubmit.click();

  await expect(dashboardPage.journalNoteCount).toHaveText("1 note");
  await expect(dashboardPage.journalEntries).toContainText("breakout level");

  await dashboardPage.page.reload();

  await expect(dashboardPage.journalEntries).toContainText("breakout level");
  await dashboardPage.page.locator('[data-testid^="delete-note-"]').first().click();
  await expect(dashboardPage.journalEmpty).toBeVisible();
});

test("price alert form handles validation and success", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("50000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertTargetError).toContainText("meaningfully different");

  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("55000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertMessage).toContainText("Alert saved for Bitcoin");
  await expect(dashboardPage.alertTable).toContainText("Bitcoin");
  await expect(dashboardPage.alertTable).toContainText("$55000.00");
  await expect(dashboardPage.alertTable).toContainText("trader@example.com");
});

test("price alerts persist across page reloads", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("persistence@example.com");
  await dashboardPage.priceAlertTarget.fill("60000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("persistence@example.com");

  await dashboardPage.page.reload();
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.alertTable).toContainText("persistence@example.com");
  await expect(dashboardPage.alertTable).toContainText("$60000.00");
});

test("price alerts can be deleted with confirmation message", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Create an alert first
  await dashboardPage.priceAlertEmail.fill("delete@example.com");
  await dashboardPage.priceAlertTarget.fill("65000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("delete@example.com");

  // Get the alert ID from the delete button
  const deleteButton = dashboardPage.page.locator('[data-testid^="delete-alert-"]');
  const alertId = await deleteButton
    .getAttribute("data-testid")
    .then((id) => id?.replace("delete-alert-", ""));

  // Delete the alert
  await dashboardPage.deleteAlert(alertId!);

  // Check that the delete confirmation message appears
  await expect(dashboardPage.deleteAlertMessage).toContainText(
    "Alert for Bitcoin at $65000.00 has been deleted",
  );

  // Check that the alert is removed from the table
  await expect(dashboardPage.alertTable).not.toContainText("delete@example.com");
});

test("success message auto-disappears after 3 seconds", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("auto@example.com");
  await dashboardPage.priceAlertTarget.fill("70000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertMessage).toContainText("Alert saved for Bitcoin");

  // Wait for the message to auto-disappear
  await expect(dashboardPage.priceAlertMessage).toHaveText("", { timeout: 4000 });
});

test("delete message auto-disappears after 3 seconds", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Create an alert first
  await dashboardPage.priceAlertEmail.fill("temp@example.com");
  await dashboardPage.priceAlertTarget.fill("75000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("temp@example.com");

  // Get the alert ID and delete it
  const deleteButton = dashboardPage.page.locator('[data-testid^="delete-alert-"]');
  const alertId = await deleteButton
    .getAttribute("data-testid")
    .then((id) => id?.replace("delete-alert-", ""));
  await dashboardPage.deleteAlert(alertId!);

  await expect(dashboardPage.deleteAlertMessage).toContainText("has been deleted");

  // Wait for the message to auto-disappear
  await expect(dashboardPage.deleteAlertMessage).toBeHidden({ timeout: 4000 });
});

test("watchlist counter increments and decrements correctly with multiple toggles", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // Verify watchlist starts at 0
  await expect(dashboardPage.watchlistCountPill).toContainText("0");

  // Add Bitcoin to watchlist
  await dashboardPage.toggleFavorite("bitcoin");
  await expect(dashboardPage.watchlistCountPill).toContainText("1");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-bitcoin")).toContainText("Saved");

  // Add Ethereum to watchlist
  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Saved");

  // Add Solana to watchlist
  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.watchlistCountPill).toContainText("3");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  // Remove Ethereum from watchlist
  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Watch");

  // Remove Bitcoin from watchlist
  await dashboardPage.toggleFavorite("bitcoin");
  await expect(dashboardPage.watchlistCountPill).toContainText("1");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-bitcoin")).toContainText("Watch");

  // Remove Solana from watchlist
  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.watchlistCountPill).toContainText("0");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Watch");
});

test("watchlist counter persists after reload with multiple items", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // Add multiple coins to watchlist
  await dashboardPage.toggleFavorite("bitcoin");
  await dashboardPage.toggleFavorite("ethereum");
  await dashboardPage.toggleFavorite("solana");

  await expect(dashboardPage.watchlistCountPill).toContainText("3");

  // Reload and verify watchlist persists
  await dashboardPage.page.reload();
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.watchlistCountPill).toContainText("3");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-bitcoin")).toContainText("Saved");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Saved");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  // Remove one and verify count updates
  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");

  // Reload again and verify persistence
  await dashboardPage.page.reload();
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.watchlistCountPill).toContainText("2");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-bitcoin")).toContainText("Saved");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Watch");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");
});
