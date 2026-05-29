import { expect, test, type Page } from "@playwright/test";

type SupabaseRow = Record<string, unknown>;

type TestResultFixture = {
  run_id: string;
  suite: string;
  test_name: string | null;
  status: string;
  error_message: string | null;
};

type QaAnalyticsFixtures = {
  runs: SupabaseRow[];
  allResults: TestResultFixture[];
  aiAnalyses: SupabaseRow[];
  trends: SupabaseRow[];
};

function createQaAnalyticsFixtures(options?: {
  analyses?: SupabaseRow[];
  results?: TestResultFixture[];
  runs?: SupabaseRow[];
  trends?: SupabaseRow[];
}) {
  const runs =
    options?.runs ?? [
      {
        id: "run-3",
        branch: "main",
        commit_sha: "aaaabbbbccccdddd",
        created_at: "2026-05-25T10:00:00.000Z",
        passed: 17,
        failed: 3,
        total_tests: 20,
      },
      {
        id: "run-2",
        branch: "feature/analytics",
        commit_sha: "abcdef1234567890",
        created_at: "2026-05-24T10:00:00.000Z",
        passed: 18,
        failed: 2,
        total_tests: 20,
      },
    ];

  const allResults =
    options?.results ??
    [
      {
        run_id: "run-3",
        suite: "dashboard/search.spec.ts",
        test_name: "Search by symbol finds the coin",
        status: "failed",
        error_message: "Latest flaky selector broke again.",
      },
      {
        run_id: "run-3",
        suite: "dashboard/checkout.spec.ts",
        test_name: "Checkout flow completes with coupon",
        status: "failed",
        error_message: "Coupon banner never appeared.",
      },
      {
        run_id: "run-2",
        suite: "dashboard/search.spec.ts",
        test_name: "Search by symbol finds the coin",
        status: "passed",
        error_message: null,
      },
      {
        run_id: "run-2",
        suite: "dashboard/error.spec.ts",
        test_name: "History fetch handles a 429 response",
        status: "passed",
        error_message: null,
      },
    ];

  const aiAnalyses = options?.analyses ?? [];

  const trends =
    options?.trends ?? [
      { date: "2026-05-24", passed: 18, failed: 2, pass_rate: 90 },
      { date: "2026-05-25", passed: 17, failed: 3, pass_rate: 85 },
    ];

  return { runs, allResults, aiAnalyses, trends };
}

async function mockSupabaseRoutes(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.includes("/test_runs")) {
      await route.fulfill({ json: fixtures.runs });
      return;
    }

    if (url.pathname.includes("/ai_analysis")) {
      const runIdFilter = url.searchParams.get("run_id")?.replace(/^eq\./, "");
      const errorMessageFilter = url.searchParams.get("error_message")?.replace(/^eq\./, "");
      const payload = fixtures.aiAnalyses.filter((analysis) =>
        (runIdFilter ? analysis.run_id === runIdFilter : true) &&
        (errorMessageFilter ? analysis.error_message === errorMessageFilter : true),
      );

      await route.fulfill({ json: payload });
      return;
    }

    if (url.pathname.includes("/test_results")) {
      const runIdFilter = url.searchParams.get("run_id")?.replace(/^eq\./, "");
      const statusFilter = url.searchParams.get("status")?.replace(/^eq\./, "");

      const payload = fixtures.allResults.filter((result) => {
        const matchesRun = runIdFilter ? result.run_id === runIdFilter : true;
        const matchesStatus = statusFilter ? result.status === statusFilter : true;

        return matchesRun && matchesStatus;
      });

      await route.fulfill({ json: payload });
      return;
    }

    await route.continue();
  });
}

async function mockQaAnalyticsApi(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/api/qa-analytics/test-trends**", async (route) => {
    await route.fulfill({ json: { data: fixtures.trends, days: 30 } });
  });
}

test("local qa analytics requires a run, shows the branch and only reveals AI analysis after analyzing the latest run", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures();
  fixtures.aiAnalyses = [
    {
      id: "historical-1",
      run_id: "run-2",
      test_name: "Search by symbol finds the coin",
      ai_summary: "Historical analysis should not appear in the latest local run view.",
      suggested_fix: "Ignore this historical record.",
      severity: "low",
      classification: "test_issue",
      confidence: 55,
      target_file: "tests/e2e/dashboard/search.spec.ts",
      generated_patch: null,
    },
  ];

  await mockSupabaseRoutes(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/analytics/ai", async (route) => {
    const body = route.request().postDataJSON() as {
      action: string;
      provider?: string;
      failures?: Array<{ testName: string }>;
      analysisId?: string;
    };

    if (body.action === "analyze") {
      const firstFailure = body.failures?.[0];
      const analyses = [
        {
          id: "42",
          test_name: firstFailure?.testName || "Search by symbol finds the coin",
          error_message: "Latest flaky selector broke again.",
          created_at: "2026-05-25T10:05:00.000Z",
          ai_summary: "Gemini found a fragile selector in the failing test.",
          suggested_fix: "Switch the test to a stable data-testid selector.",
          severity: "high",
          classification: "test_issue",
          confidence: 96,
          target_file: "tests/e2e/dashboard/search.spec.ts",
          generated_patch:
            "diff --git a/tests/e2e/dashboard/search.spec.ts b/tests/e2e/dashboard/search.spec.ts\n--- a/tests/e2e/dashboard/search.spec.ts\n+++ b/tests/e2e/dashboard/search.spec.ts\n@@ -1 +1 @@\n-old selector\n+new selector",
        },
        {
          id: "43",
          test_name: firstFailure?.testName || "Search by symbol finds the coin",
          error_message: "Latest flaky selector broke again.",
          created_at: "2026-05-25T10:04:00.000Z",
          ai_summary: "This looks related, but the confidence is low and the fix is not yet actionable.",
          suggested_fix: "Treat this as a low-confidence note until the selector issue is confirmed.",
          severity: "low",
          classification: "test_issue",
          confidence: 30,
          target_file: "tests/e2e/dashboard/search.spec.ts",
          generated_patch: null,
        },
      ];

      fixtures.aiAnalyses = [...fixtures.aiAnalyses, ...analyses];

      await route.fulfill({
        json: {
          provider: body.provider,
          skipped: [],
          analyses,
        },
      });
      return;
    }

    if (body.action === "apply") {
      await route.fulfill({
        json: {
          branchName: "feature/source",
          applyMode: "local",
          committed: false,
          filePath: "tests/e2e/dashboard/search.spec.ts",
        },
      });
      return;
    }

    await route.fulfill({ json: { error: "Unsupported action." }, status: 400 });
  });

  await page.goto("/qa-analytics");

  await expect(page.getByRole("heading", { name: "Latest local run" })).toBeVisible();
  await expect(page.getByText(/Branch:/)).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("gemini");
  await expect(page.getByText("Use the first button to analyze every failure in the latest run")).toBeVisible();
  await expect(page.getByTestId("ai-analyze-all")).toContainText("Analyze all failures");
  await expect(page.getByTestId("ai-auto-apply-all")).toContainText("Analyze all and auto-apply safe fixes");
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeVisible();
  await expect(page.getByTestId("failing-test-checkout-flow-completes-with-coupon")).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toHaveCount(0);
  await expect(page.getByTestId("test-trends-chart")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Top failures" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Flaky tests" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Branch health" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI failure analysis" })).toHaveCount(0);

  await page.getByTestId("ai-analyze-all").click();

  await expect(page.getByTestId("ai-status-message")).toContainText("Gemini");
  await expect(page.getByRole("button", { name: "Analyze this failure" })).toHaveCount(2);
  await expect(page.getByTestId("ai-analysis-card-42")).toBeVisible();
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText("fragile selector");
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText("Apply AI fix");
  await expect(page.getByRole("button", { name: "Apply AI fix" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Not actionable" })).toHaveCount(0);
  await expect(page.getByText("View 1 lower-confidence alternative")).toBeVisible();
  await expect(page.getByText("Historical analysis should not appear in the latest local run view.")).toHaveCount(0);
});

test("local qa analytics prompts to run Playwright when no local run is available", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures({
    runs: [],
    results: [],
    trends: [],
  });

  await mockSupabaseRoutes(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/qa-analytics");

  await expect(page.getByText("No local run found")).toBeVisible();
  await expect(page.getByText("Run your Playwright suite locally and sync the latest results")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toHaveCount(0);
  await expect(page.getByTestId("test-trends-chart")).toHaveCount(0);
});

test("live qa analytics hides local-only sections and keeps the trend chart below total runs", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures();

  await mockSupabaseRoutes(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/qa-analytics?view=live");

  await expect(page.getByRole("heading", { name: "Metrics overview" })).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toBeVisible();
  await expect(page.getByTestId("test-trends-chart")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Latest run failures" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI failure analysis" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Runs" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Top failures" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flaky tests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Branch health" })).toBeVisible();
});
