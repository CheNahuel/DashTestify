import { expect, Locator, Page } from "@playwright/test";
import { getRangeButtonTestId } from "@tests//utils/dateUtils";

export class DashboardPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;
  readonly trendSelect: Locator;
  readonly favoritesFilter: Locator;
  readonly resetButton: Locator;
  readonly selectedAssetName: Locator;
  readonly selectedAssetPrice: Locator;
  readonly selectedAssetChange: Locator;
  readonly coinsList: Locator;
  readonly journalInput: Locator;
  readonly journalSubmit: Locator;
  readonly journalEntries: Locator;
  readonly journalNoteCount: Locator;
  readonly journalError: Locator;
  readonly journalEmpty: Locator;
  readonly priceAlertEmail: Locator;
  readonly priceAlertTarget: Locator;
  readonly priceAlertSubmit: Locator;
  readonly priceAlertMessage: Locator;
  readonly priceAlertTargetError: Locator;
  readonly marketErrorBanner: Locator;
  readonly noMatchMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByTestId("search-input");
    this.sortSelect = page.getByTestId("sort-select");
    this.trendSelect = page.getByTestId("trend-select");
    this.favoritesFilter = page.getByTestId("favorites-filter");
    this.resetButton = page.getByTestId("reset-dashboard");
    this.selectedAssetName = page.getByTestId("selected-asset-name");
    this.selectedAssetPrice = page.getByTestId("selected-asset-price");
    this.selectedAssetChange = page.getByTestId("selected-asset-change");
    this.coinsList = page.getByTestId("coins-list");
    this.journalInput = page.getByTestId("journal-input");
    this.journalSubmit = page.getByTestId("journal-submit");
    this.journalEntries = page.getByTestId("journal-entries");
    this.journalNoteCount = page.getByTestId("journal-note-count");
    this.journalError = page.getByTestId("journal-error");
    this.journalEmpty = page.getByTestId("journal-empty");
    this.priceAlertEmail = page.getByTestId("price-alert-email");
    this.priceAlertTarget = page.getByTestId("price-alert-target");
    this.priceAlertSubmit = page.getByTestId("price-alert-submit");
    this.priceAlertMessage = page.getByTestId("price-alert-message");
    this.priceAlertTargetError = page.getByTestId("price-alert-target-error");
    this.marketErrorBanner = page.getByTestId("market-error-banner");
    this.noMatchMessage = page.getByTestId("no-match-message");
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  async selectSort(value: string) {
    await this.sortSelect.selectOption(value);
  }

  async selectTrend(value: string) {
    await this.trendSelect.selectOption(value);
  }

  async searchFor(value: string) {
    await this.searchInput.fill(value);
  }

  async toggleFavorite(coinId: string) {
    await this.page.getByTestId(`favorite-toggle-${coinId}`).click();
  }

  async expectSelectedAsset(name: string) {
    await expect(this.selectedAssetName).toHaveText(name);
  }

  async expectRangeSelected(days: number) {
    await expect(this.page.getByTestId(getRangeButtonTestId(days))).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }

  coinCard(coinId: string) {
    return this.page.locator(`[data-testid="coin-card"][data-coin-id="${coinId}"]`);
  }
}
