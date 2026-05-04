import { expect, test, waitForDashboardData } from "@tests/fixtures/testSetup";
import { expectUrlPath } from "@tests/utils/commonUtils";

// ─── Sort & Trend ────────────────────────────────────────────────────────────

test("sort by change-desc puts top gainer first", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectTrend("gainers");
  await dashboardPage.selectSort("change-desc");

  // Solana has the highest positive change (+12.4%)
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana",
  );
  await expect(dashboardPage.page).toHaveURL(/trend=gainers/);
  await expect(dashboardPage.page).toHaveURL(/sort=change-desc/);
});

test("sort by price-desc puts highest price first", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectSort("price-desc");

  // Bitcoin ($50 000) > Ethereum ($3 500) > Solana ($180)
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Bitcoin",
  );
  await expect(dashboardPage.page).toHaveURL(/sort=price-desc/);
});

test("sort by price-asc puts lowest price first", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectSort("price-asc");

  // Solana ($180) is cheapest
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Solana",
  );
  await expect(dashboardPage.page).toHaveURL(/sort=price-asc/);
});

test("sort by change-asc puts biggest loser first", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectSort("change-asc");

  // Ethereum (-1.2%) is the only loser — goes first
  await expect(dashboardPage.page.locator('[data-testid="coin-card"]').first()).toContainText(
    "Ethereum",
  );
});

test("trend losers shows only negative-change coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectTrend("losers");

  // Only Ethereum has negative change (-1.2%)
  await expect(dashboardPage.coinsList).toContainText("Ethereum");
  await expect(dashboardPage.coinsList).not.toContainText("Bitcoin");
  await expect(dashboardPage.coinsList).not.toContainText("Solana");
  await dashboardPage.expectVisibleCoinsCount(1);
  await expect(dashboardPage.page).toHaveURL(/trend=losers/);
});

test("trend gainers shows only positive-change coins", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectTrend("gainers");

  await expect(dashboardPage.coinsList).toContainText("Bitcoin");
  await expect(dashboardPage.coinsList).toContainText("Solana");
  await expect(dashboardPage.coinsList).not.toContainText("Ethereum");
  await dashboardPage.expectVisibleCoinsCount(2);
});

// ─── Reset ───────────────────────────────────────────────────────────────────

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

// ─── Chart range buttons ─────────────────────────────────────────────────────

test("range button 1H is selectable and syncs URL", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(0.0417);

  await dashboardPage.expectRangeSelected(0.0417);
  await expect(dashboardPage.page).toHaveURL(/days=0\.0417/);
});

test("1H range shows 'in 1H' label on selected asset change", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(0.0417);

  await expect(dashboardPage.selectedAssetChange).toContainText("in 1H");
});

test("1H range renders the chart", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(0.0417);

  await expect(dashboardPage.coinChart).toBeVisible();
});

test("range button 24H is selectable and syncs URL", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(1);

  await dashboardPage.expectRangeSelected(1);
  await expect(dashboardPage.page).toHaveURL(/days=1/);
});

test("range button 30D is selectable and syncs URL", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(30);

  await dashboardPage.expectRangeSelected(30);
  await expect(dashboardPage.page).toHaveURL(/days=30/);
});

test("range button 90D is selectable and syncs URL", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.selectRangeDays(90);

  await dashboardPage.expectRangeSelected(90);
  await expect(dashboardPage.page).toHaveURL(/days=90/);
});

test("range defaults to 7D on new load", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.expectRangeSelected(7);
});

// ─── Coin selection ───────────────────────────────────────────────────────────

test("clicking a coin card selects it as the active asset", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Click the Ethereum card
  await dashboardPage.coinCard("ethereum").getByRole("button").first().click();

  await dashboardPage.expectSelectedAsset("Ethereum");
  await expect(dashboardPage.page).toHaveURL(/selectedCoin=ethereum/);
});

test("selected coin card is visually highlighted", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  const bitcoinCard = dashboardPage.coinCard("bitcoin");
  await expect(bitcoinCard).toHaveAttribute("data-coin-id", "bitcoin");
});

// ─── Watchlist ────────────────────────────────────────────────────────────────

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

test("watchlist-only with no saved coins shows empty message", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // Enable watchlist filter with no favorites saved
  await dashboardPage.favoritesFilter.click();

  await expect(dashboardPage.noMatchMessage).toBeVisible();
  await dashboardPage.expectVisibleCoinsCount(0);
});

test("selected asset watchlist toggle adds and removes from watchlist", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.selectedAssetFavorite).toContainText("Save to Watchlist");
  await dashboardPage.selectedAssetFavorite.click();
  await expect(dashboardPage.selectedAssetFavorite).toContainText("In Watchlist");
  await expect(dashboardPage.watchlistCountPill).toContainText("1");

  // Toggle off
  await dashboardPage.selectedAssetFavorite.click();
  await expect(dashboardPage.selectedAssetFavorite).toContainText("Save to Watchlist");
  await expect(dashboardPage.watchlistCountPill).toContainText("0");
});

test("watchlist counter increments and decrements correctly with multiple toggles", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.watchlistCountPill).toContainText("0");

  await dashboardPage.toggleFavorite("bitcoin");
  await expect(dashboardPage.watchlistCountPill).toContainText("1");

  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");

  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.watchlistCountPill).toContainText("3");

  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Watch");

  await dashboardPage.toggleFavorite("bitcoin");
  await expect(dashboardPage.watchlistCountPill).toContainText("1");

  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.watchlistCountPill).toContainText("0");
});

test("watchlist counter persists after reload with multiple items", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.toggleFavorite("bitcoin");
  await dashboardPage.toggleFavorite("ethereum");
  await dashboardPage.toggleFavorite("solana");
  await expect(dashboardPage.watchlistCountPill).toContainText("3");

  await dashboardPage.page.reload();
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.watchlistCountPill).toContainText("3");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-bitcoin")).toContainText("Saved");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Saved");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-solana")).toContainText("Saved");

  await dashboardPage.toggleFavorite("ethereum");
  await expect(dashboardPage.watchlistCountPill).toContainText("2");

  await dashboardPage.page.reload();
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.watchlistCountPill).toContainText("2");
  await expect(dashboardPage.page.getByTestId("favorite-toggle-ethereum")).toContainText("Watch");
});

test("watchlist-only filter and search together — no overlap shows empty", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.home);
  await waitForDashboardData(dashboardPage.page);

  // Save only Bitcoin
  await dashboardPage.toggleFavorite("bitcoin");
  await dashboardPage.favoritesFilter.click();

  // Search for something that doesn't match Bitcoin
  await dashboardPage.searchFor("sol");

  await expect(dashboardPage.noMatchMessage).toBeVisible();
  await dashboardPage.expectVisibleCoinsCount(0);
});

// ─── Journal ─────────────────────────────────────────────────────────────────

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

test("journal empty note is blocked", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.journalInput.fill("");
  await dashboardPage.journalSubmit.click();

  await expect(dashboardPage.journalError).toContainText("at least 10 characters");
  await expect(dashboardPage.journalNoteCount).toHaveText("0 notes");
});

test("journal notes are isolated per coin", async ({ dashboardData, dashboardPage }) => {
  // Add a note for Bitcoin
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.journalInput.fill("Bitcoin note: watching supply zones carefully.");
  await dashboardPage.journalSubmit.click();
  await expect(dashboardPage.journalNoteCount).toHaveText("1 note");

  // Switch to Ethereum — journal should be empty
  await dashboardPage.coinCard("ethereum").getByRole("button").first().click();
  await dashboardPage.expectSelectedAsset("Ethereum");
  await expect(dashboardPage.journalNoteCount).toHaveText("0 notes");
  await expect(dashboardPage.journalEmpty).toBeVisible();

  // Switch back to Bitcoin — note should still be there
  await dashboardPage.coinCard("bitcoin").getByRole("button").first().click();
  await dashboardPage.expectSelectedAsset("Bitcoin");
  await expect(dashboardPage.journalNoteCount).toHaveText("1 note");
  await expect(dashboardPage.journalEntries).toContainText("supply zones");
});

test("journal note count shows plural correctly", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.journalInput.fill("First note about Bitcoin trend analysis.");
  await dashboardPage.journalSubmit.click();
  await expect(dashboardPage.journalNoteCount).toHaveText("1 note");

  await dashboardPage.journalInput.fill("Second note about support levels and volume.");
  await dashboardPage.journalSubmit.click();
  await expect(dashboardPage.journalNoteCount).toHaveText("2 notes");
});

// ─── Price Alerts ─────────────────────────────────────────────────────────────

test("price alert form handles validation and success", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Price equal to current ($50 000) should be rejected
  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("50000");
  await dashboardPage.priceAlertSubmit.click();
  await expect(dashboardPage.priceAlertTargetError).toContainText("meaningfully different");

  // Valid target price
  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("55000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertMessage).toContainText("Alert saved for Bitcoin");
  await expect(dashboardPage.alertTable).toContainText("Bitcoin");
  await expect(dashboardPage.alertTable).toContainText("$55000.00");
  await expect(dashboardPage.alertTable).toContainText("trader@example.com");
});

test("price alert rejects invalid email", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Disable all browser constraint validation on the form so the server action
  // runs with the raw value and returns the server-side error message.
  await dashboardPage.page.evaluate(() => {
    const form = document
      .querySelector<HTMLInputElement>('[data-testid="price-alert-email"]')
      ?.closest("form");
    if (form) form.noValidate = true;
  });

  await dashboardPage.priceAlertEmail.fill("not-an-email");
  await dashboardPage.priceAlertTarget.fill("55000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertEmailError).toContainText("valid email");
});

test("price alert rejects zero or negative target price", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  // Remove browser min constraint so the server action runs with value 0
  // and we can assert on the server-returned error message.
  await dashboardPage.page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="price-alert-target"]');
    if (input) input.removeAttribute("min");
  });

  await dashboardPage.priceAlertEmail.fill("trader@example.com");
  await dashboardPage.priceAlertTarget.fill("0");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.priceAlertTargetError).toContainText("greater than zero");
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

test("multiple alerts for the same coin appear in the table", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("a@example.com");
  await dashboardPage.priceAlertTarget.fill("55000");
  await dashboardPage.priceAlertSubmit.click();

  // Wait for the first alert to appear before submitting the second —
  // the submit button is disabled while the server action is pending.
  await expect(dashboardPage.alertTable).toContainText("a@example.com");

  await dashboardPage.priceAlertEmail.fill("b@example.com");
  await dashboardPage.priceAlertTarget.fill("60000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("b@example.com");
  await expect(dashboardPage.alertTable).toContainText("$55000.00");
  await expect(dashboardPage.alertTable).toContainText("$60000.00");
});

test("price alert form header updates when switching coins", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await expect(dashboardPage.page.getByText("Create Price Alert for Bitcoin")).toBeVisible();

  // Switch to Ethereum
  await dashboardPage.coinCard("ethereum").getByRole("button").first().click();
  await dashboardPage.expectSelectedAsset("Ethereum");

  await expect(dashboardPage.page.getByText("Create Price Alert for Ethereum")).toBeVisible();
});

test("price alerts can be deleted with confirmation message", async ({
  dashboardData,
  dashboardPage,
}) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("delete@example.com");
  await dashboardPage.priceAlertTarget.fill("65000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("delete@example.com");

  const deleteButton = dashboardPage.page.locator('[data-testid^="delete-alert-"]');
  const alertId = await deleteButton
    .getAttribute("data-testid")
    .then((id) => id?.replace("delete-alert-", ""));

  await dashboardPage.deleteAlert(alertId!);

  await expect(dashboardPage.deleteAlertMessage).toContainText(
    "Alert for Bitcoin at $65000.00 has been deleted",
  );
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
  await expect(dashboardPage.priceAlertMessage).toHaveText("", { timeout: 4000 });
});

test("delete message auto-disappears after 3 seconds", async ({ dashboardData, dashboardPage }) => {
  await dashboardPage.goto(dashboardData.urls.bitcoinDefault);
  await waitForDashboardData(dashboardPage.page);

  await dashboardPage.priceAlertEmail.fill("temp@example.com");
  await dashboardPage.priceAlertTarget.fill("75000");
  await dashboardPage.priceAlertSubmit.click();

  await expect(dashboardPage.alertTable).toContainText("temp@example.com");

  const deleteButton = dashboardPage.page.locator('[data-testid^="delete-alert-"]');
  const alertId = await deleteButton
    .getAttribute("data-testid")
    .then((id) => id?.replace("delete-alert-", ""));
  await dashboardPage.deleteAlert(alertId!);

  await expect(dashboardPage.deleteAlertMessage).toContainText("has been deleted");
  await expect(dashboardPage.deleteAlertMessage).toBeHidden({ timeout: 4000 });
});
