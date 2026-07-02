import { expect, Locator, Page } from "@playwright/test";

export class MetricsPage {
  readonly page: Page;
  readonly backToHomeButton: Locator;
  readonly refreshButton: Locator;
  readonly header: Locator;
  readonly statsTotalRuns: Locator;
  readonly statsPassRate: Locator;
  readonly statsPassedTests: Locator;
  readonly statsFailedTests: Locator;
  readonly testTrendsChart: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backToHomeButton = page.getByTestId("back-to-home-button");
    this.refreshButton = page.getByTestId("refresh-button");
    this.header = page.locator("header").first();
    this.statsTotalRuns = page.getByTestId("stats-total-runs");
    this.statsPassRate = page.getByTestId("stats-pass-rate");
    this.statsPassedTests = page.getByTestId("stats-passed-tests");
    this.statsFailedTests = page.getByTestId("stats-failed-tests");
    this.testTrendsChart = page.getByTestId("test-trends-chart");
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  async clickBackToHome() {
    await this.backToHomeButton.click();
  }

  async clickRefresh() {
    await this.refreshButton.click();
  }

  async expectBackToHomeButtonVisible() {
    await expect(this.backToHomeButton).toBeVisible();
  }

  async expectRefreshButtonVisible() {
    await expect(this.refreshButton).toBeVisible();
  }

  async expectRefreshButtonDisabled() {
    await expect(this.refreshButton).toBeDisabled();
  }

  async expectRefreshButtonEnabled() {
    await expect(this.refreshButton).toBeEnabled();
  }

  async expectStatsVisible() {
    await expect(this.statsTotalRuns).toBeVisible();
    await expect(this.statsPassRate).toBeVisible();
    await expect(this.statsPassedTests).toBeVisible();
    await expect(this.statsFailedTests).toBeVisible();
  }

  async expectTrendChartVisible() {
    await expect(this.testTrendsChart).toBeVisible();
  }

  async waitForRefreshToComplete() {
    await expect(this.refreshButton).toBeEnabled();
  }
}
