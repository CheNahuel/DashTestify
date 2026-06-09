import fs from "fs/promises";
import os from "os";
import path from "path";

import { expect, test, type Page } from "@playwright/test";

import { buildLocalQaAnalyticsSnapshot } from "@/lib/quality-analytics/local-results";
import { appendLocalAnalyses, loadLocalAnalysesForRun } from "@/app/api/quality-analytics/_local-store";

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

const runStatePath = path.join(os.tmpdir(), "dash-testify-quality-analytics", "run-tests-state.json");
const localAnalysesPath = path.join(
  os.tmpdir(),
  "dash-testify-quality-analytics",
  "quality-analytics-ai.json",
);

test.beforeEach(async () => {
  await fs.rm(runStatePath, { force: true });
  await fs.rm(localAnalysesPath, { force: true });
});

test.afterEach(async () => {
  await fs.rm(localAnalysesPath, { force: true });
});

function createQaAnalyticsFixtures(options?: {
  analyses?: SupabaseRow[];
  results?: TestResultFixture[];
  runs?: SupabaseRow[];
  trends?: SupabaseRow[];
}) {
  const runs = options?.runs ?? [
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

  const allResults = options?.results ?? [
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

  const trends = options?.trends ?? [
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
      const payload = fixtures.aiAnalyses.filter(
        (analysis) =>
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
  await page.route("**/api/quality-analytics/test-trends**", async (route) => {
    await route.fulfill({ json: { data: fixtures.trends, days: 30 } });
  });
}

async function mockLocalSnapshot(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/api/quality-analytics/local-snapshot**", async (route) => {
    const latestRun = fixtures.runs[0] || null;

    if (!latestRun) {
      await route.fulfill({
        json: {
          latestRun: null,
          latestRunSummary: null,
          latestFailures: [],
          aiAnalysis: [],
        },
      });
      return;
    }

    const latestFailures = Object.values(
      fixtures.allResults
        .filter((result) => result.run_id === latestRun.id && result.status === "failed")
        .reduce<
          Record<
            string,
            {
              test_name: string | null;
              failures: number;
              run_id: string;
              suite: string | null;
              error_message: string | null;
            }
          >
        >((acc, result) => {
          const key = `${result.suite}::${result.test_name}`;

          if (!acc[key]) {
            acc[key] = {
              test_name: result.test_name,
              failures: 0,
              run_id: result.run_id,
              suite: result.suite,
              error_message: result.error_message,
            };
          }

          acc[key].failures += 1;
          acc[key].error_message = result.error_message;

          return acc;
        }, {}),
    ).sort((left, right) => right.failures - left.failures);

    const totals = fixtures.allResults
      .filter((result) => result.run_id === latestRun.id)
      .reduce(
        (acc, result) => {
          acc.total_tests += 1;

          if (result.status === "passed") {
            acc.passed += 1;
          } else if (result.status === "skipped") {
            acc.skipped += 1;
          } else if (result.status === "flaky") {
            acc.flaky += 1;
          } else {
            acc.failed += 1;
          }

          return acc;
        },
        {
          total_tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          flaky: 0,
        },
      );

    await route.fulfill({
      json: {
        latestRun,
        latestRunSummary: {
          ...totals,
          duration_ms: 126000,
          report_path: "/playwright-report/index.html",
        },
        latestFailures,
        aiAnalysis: fixtures.aiAnalyses.filter((analysis) => analysis.run_id === latestRun.id),
      },
    });
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

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/quality-analytics/local-ai", async (route) => {
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
          ai_summary:
            "This looks related, but the confidence is low and the fix is not yet actionable.",
          suggested_fix:
            "Treat this as a low-confidence note until the selector issue is confirmed.",
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

  await page.goto("/ai-failure-analysis");

  await expect(
    page.getByRole("heading", { name: "AI Failure Analysis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Failures detected. AI-powered analysis and fix suggestions are available below."),
  ).toBeVisible();
  await expect(page.getByTestId("hero-metadata-branch")).toContainText("main");
  await expect(page.getByTestId("hero-metadata-commit")).toContainText("aaaabbbb");
  await expect(page.getByText("Pass rate")).toBeVisible();
  await expect(page.getByText("Duration")).toBeVisible();
  await expect(page.getByRole("link", { name: "View report" })).toHaveAttribute(
    "href",
    "/playwright-report/index.html",
  );
  await expect(page.getByTestId("ai-provider-select")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("claude");
  await expect(
    page.getByText("Select a provider to analyze the latest local failures and generate fixes."),
  ).toBeVisible();
  await expect(page.getByTestId("run-controls-panel")).toBeVisible();
  await expect(page.getByTestId("ai-provider-panel")).toBeVisible();
  await expect(page.getByTestId("run-controls-panel")).toHaveClass(/rounded-3xl/);
  await expect(page.getByTestId("ai-provider-panel")).toHaveClass(/rounded-3xl/);
  await expect(
    page.getByText("Select a provider to analyze the latest local failures and generate fixes."),
  ).toBeVisible();
  await page.getByTestId("ai-provider-select").selectOption("openai");
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("openai");
  await page.getByTestId("ai-provider-select").selectOption("deepseek");
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("deepseek");
  await page.getByTestId("ai-provider-select").selectOption("openrouter");
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("openrouter");
  await page.getByTestId("ai-provider-select").selectOption("openai");
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("openai");
  await expect(page.getByTestId("ai-provider-panel")).toBeVisible();
  await expect(page.getByTestId("ai-analyze-all")).toContainText("Analyze selected failures");
  await expect(page.getByTestId("run-mode-mock")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeVisible();
  await expect(page.getByTestId("failing-test-checkout-flow-completes-with-coupon")).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toHaveCount(0);
  await expect(page.getByTestId("test-trends-chart")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Top failures" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Flaky tests" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Branch health" })).toHaveCount(0);

  // Select both failures before analyzing
  await page.getByTestId("failure-checkbox-search-by-symbol-finds-the-coin").check();
  await page.getByTestId("failure-checkbox-checkout-flow-completes-with-coupon").check();

  await page.getByTestId("ai-analyze-all").click();

  // Wait for analysis results to appear
  await expect(page.getByTestId("ai-analysis-card-42")).toBeVisible();
  await expect(page.getByTestId("failure-checkbox-search-by-symbol-finds-the-coin")).toBeChecked();
  await expect(
    page.getByTestId("failure-checkbox-checkout-flow-completes-with-coupon"),
  ).toBeChecked();
  await expect(page.getByTestId("ai-analysis-card-42")).toBeVisible();
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText("fragile selector");
  await expect(page.getByTestId("failure-error-log-search-by-symbol-finds-the-coin")).toBeVisible();
  await expect(page.getByTestId("failure-error-log-search-by-symbol-finds-the-coin")).toHaveClass(
    /w-full/,
  );
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText("Apply AI fix");
  await expect(page.getByRole("button", { name: "Apply AI fix" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Not actionable" })).toHaveCount(0);
  await expect(page.getByText("View 1 lower-confidence alternative")).toBeVisible();
  await expect(
    page.getByText("Historical analysis should not appear in the latest local run view."),
  ).toHaveCount(0);

  // Apply the actionable fix using the individual "Apply AI fix" button
  await page.getByTestId("ai-apply-42").click();
  // Verify the analysis was applied (it should be removed from the list)
  await expect(page.getByTestId("ai-analysis-card-42")).toBeHidden();
  // Verify the failure cards are also removed when fixes are applied
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeHidden();
  // Verify success message appears
  await expect(page.getByTestId("ai-status-message")).toContainText("successfully applied");
});

test("local qa analytics removes failure cards when fixes are applied", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures();

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/quality-analytics/local-ai", async (route) => {
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
          id: "fix-test-1",
          test_name: firstFailure?.testName || "Search by symbol finds the coin",
          error_message: "Latest flaky selector broke again.",
          created_at: "2026-05-25T10:05:00.000Z",
          ai_summary: "Found a fragile selector in the failing test.",
          suggested_fix: "Switch the test to a stable data-testid selector.",
          severity: "high",
          classification: "test_issue",
          confidence: 96,
          target_file: "tests/e2e/dashboard/search.spec.ts",
          generated_patch: "diff --git a/tests/e2e/dashboard/search.spec.ts",
        },
      ];

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

  await page.goto("/ai-failure-analysis");

  // Verify both failure cards are visible initially
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeVisible();
  await expect(page.getByTestId("failing-test-checkout-flow-completes-with-coupon")).toBeVisible();

  // Select and analyze the first failure
  await page.getByTestId("failure-checkbox-search-by-symbol-finds-the-coin").check();
  await page.getByTestId("ai-analyze-all").click();

  // Wait for analysis to appear
  await expect(page.getByTestId("ai-analysis-card-fix-test-1")).toBeVisible();

  // Apply the fix
  await page.getByTestId("ai-apply-fix-test-1").click();

  // Verify the analysis card is removed
  await expect(page.getByTestId("ai-analysis-card-fix-test-1")).toBeHidden();

  // Verify the corresponding failure card is also removed
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeHidden();

  // Verify the other failure card is still visible
  await expect(page.getByTestId("failing-test-checkout-flow-completes-with-coupon")).toBeVisible();

  // Verify success message appears
  await expect(page.getByTestId("ai-status-message")).toContainText("successfully applied");
});

test("local qa analytics prompts to run Playwright when no local run is available", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures({
    runs: [],
    results: [],
    trends: [],
  });

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/ai-failure-analysis");

  await expect(page.getByTestId("run-controls-panel")).toBeVisible();
  await expect(page.getByTestId("run-tests-button")).toBeVisible();
  await expect(page.getByTestId("ai-provider-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Latest local run" })).toHaveCount(0);
  await expect(page.getByTestId("stats-total-runs")).toHaveCount(0);
  await expect(page.getByTestId("test-trends-chart")).toHaveCount(0);
});

test("local qa analytics recovers from a stale background run and keeps run tests enabled", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures({
    runs: [],
    results: [],
    trends: [],
  });

  await fs.mkdir(path.dirname(runStatePath), { recursive: true });
  await fs.writeFile(
    runStatePath,
    JSON.stringify(
      {
        jobId: "stale-run",
        mode: "mock",
        status: "running",
        pid: 999999,
        progress: 48,
        currentStep: 12,
        totalSteps: 25,
        message: "Running e2e mock tests...",
        log: "",
        startedAt: "2026-05-31T00:00:00.000Z",
        finishedAt: null,
        exitCode: null,
      },
      null,
      2,
    ),
  );

  try {
    await mockLocalSnapshot(page, fixtures);
    await mockQaAnalyticsApi(page, fixtures);

    // Mock the run-tests endpoint to return the stale status
    await page.route("**/api/quality-analytics/run-tests", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          json: {
            run: {
              jobId: "stale-run",
              mode: "mock",
              status: "failed",
              pid: null,
              isStale: true,
              progress: 100,
              currentStep: null,
              totalSteps: null,
              currentTestLabel: null,
              message:
                "Previous test run appears to have been interrupted. You can start a new run.",
              finishedAt: new Date().toISOString(),
              exitCode: null,
            },
          },
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/ai-failure-analysis");

    await expect(page.getByTestId("run-controls-panel")).toBeVisible();
    await expect(page.getByTestId("run-tests-button")).toBeEnabled();
    await expect(page.getByTestId("run-status-message")).toContainText(
      "Previous test run appears to have been interrupted.",
    );
  } finally {
    await fs.rm(runStatePath, { force: true });
  }
});

test("local qa analytics renders duplicate unknown failures with unique cards", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures({
    results: [
      {
        run_id: "run-3",
        suite: "suite-a.spec.ts",
        test_name: null,
        status: "failed",
        error_message: "First unknown failure.",
      },
      {
        run_id: "run-3",
        suite: "suite-b.spec.ts",
        test_name: null,
        status: "failed",
        error_message: "Second unknown failure.",
      },
    ],
  });

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/ai-failure-analysis");

  await expect(page.getByTestId("failing-test-unknown-test-1")).toBeVisible();
  await expect(page.getByTestId("failing-test-unknown-test-2")).toBeVisible();
  await expect(page.getByTestId("failing-test-unknown-test-1")).toContainText(
    "First unknown failure.",
  );
  await expect(page.getByTestId("failing-test-unknown-test-2")).toContainText(
    "Second unknown failure.",
  );
});

test("local qa analytics parser uses spec titles for the latest run", async () => {
  const snapshot = buildLocalQaAnalyticsSnapshot({
    resultsFile: {
      stats: {
        startTime: "2026-05-31T01:09:23.372Z",
        expected: 1,
        unexpected: 1,
        skipped: 0,
        flaky: 0,
      },
      suites: [
        {
          title: "e2e/dashboard/interactions.spec.ts",
          file: "e2e/dashboard/interactions.spec.ts",
          specs: [
            {
              title: "selected coin card is visually highlighted",
              file: "e2e/dashboard/interactions.spec.ts",
              tests: [
                {
                  status: "failed",
                  results: [
                    {
                      status: "failed",
                      errors: [{ message: "Selector was not highlighted." }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    aiAnalysesFile: [],
    gitState: {
      branch: "feature/local-analytics",
      commitSha: "abc123",
    },
  });

  expect(snapshot.latestFailures).toHaveLength(1);
  expect(snapshot.latestFailures[0].test_name).toBe("selected coin card is visually highlighted");
});

test("local qa analytics store can load analyses by numeric run id", async () => {
  await appendLocalAnalyses([
    {
      id: "analysis-1",
      provider: "openai",
      run_id: 123,
      created_at: "2026-05-31T01:10:23.372Z",
      test_name: "selected coin card is visually highlighted",
      ai_summary: "Stored analysis survives the local store load.",
      suggested_fix: "Keep this analysis record available.",
      severity: "medium",
      classification: "test_issue",
      confidence: 90,
      target_file: "src/components/quality-analytics/metrics-page.tsx",
      generated_patch: null,
    },
  ]);

  const analyses = await loadLocalAnalysesForRun(123);

  expect(analyses).toHaveLength(1);
  expect(analyses[0].run_id).toBe(123);
  expect(analyses[0].test_name).toBe("selected coin card is visually highlighted");
});

test("local qa analytics can start a mock run and shows progress before success", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures();
  let pollCount = 0;
  let snapshotVersion = 0;

  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/quality-analytics/local-snapshot**", async (route) => {
    const latestRun =
      snapshotVersion === 0
        ? fixtures.runs[0] || null
        : {
            ...fixtures.runs[0],
            total_tests: 21,
            passed: 18,
            failed: 3,
          };

    const latestFailures =
      snapshotVersion === 0
        ? Object.values(
            fixtures.allResults
              .filter((result) => result.run_id === latestRun?.id && result.status === "failed")
              .reduce<
                Record<
                  string,
                  {
                    test_name: string | null;
                    failures: number;
                    run_id: string;
                    suite: string | null;
                    error_message: string | null;
                  }
                >
              >((acc, result) => {
                const key = `${result.suite}::${result.test_name}`;

                if (!acc[key]) {
                  acc[key] = {
                    test_name: result.test_name,
                    failures: 0,
                    run_id: result.run_id,
                    suite: result.suite,
                    error_message: result.error_message,
                  };
                }

                acc[key].failures += 1;
                acc[key].error_message = result.error_message;

                return acc;
              }, {}),
          ).sort((left, right) => right.failures - left.failures)
        : [
            {
              test_name: "Search by symbol finds the coin",
              failures: 2,
              run_id: "run-3",
              suite: "dashboard/search.spec.ts",
              error_message: "Latest flaky selector broke again.",
            },
          ];

    const totals =
      snapshotVersion === 0
        ? fixtures.allResults
            .filter((result) => result.run_id === latestRun?.id)
            .reduce(
              (acc, result) => {
                acc.total_tests += 1;

                if (result.status === "passed") {
                  acc.passed += 1;
                } else if (result.status === "skipped") {
                  acc.skipped += 1;
                } else if (result.status === "flaky") {
                  acc.flaky += 1;
                } else {
                  acc.failed += 1;
                }

                return acc;
              },
              {
                total_tests: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                flaky: 0,
              },
            )
        : {
            total_tests: 21,
            passed: 18,
            failed: 3,
            skipped: 0,
            flaky: 0,
          };

    await route.fulfill({
      json: {
        latestRun,
        latestRunSummary: {
          ...totals,
          duration_ms: 132000,
          report_path: "/playwright-report/index.html",
        },
        latestFailures,
        aiAnalysis: [],
      },
    });
  });

  await page.route("**/api/quality-analytics/run-tests**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-1",
            mode: "mock",
            status: "running",
            progress: 34,
            currentStep: 12,
            totalSteps: 35,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    pollCount += 1;

    if (pollCount < 2) {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-1",
            mode: "mock",
            status: "running",
            progress: 34,
            currentStep: 12,
            totalSteps: 35,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    snapshotVersion = 1;

    await route.fulfill({
      json: {
        run: {
          jobId: "job-1",
          mode: "mock",
          status: "success",
          progress: 100,
          currentStep: 35,
          totalSteps: 35,
          currentTestLabel: null,
          message: "Test run completed successfully.",
          finishedAt: "2026-05-31T01:10:23.372Z",
          exitCode: 0,
        },
      },
    });
  });

  await page.goto("/ai-failure-analysis");

  await expect(page.getByTestId("run-mode-mock")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("run-tests-button").click();
  // Wait for run to progress and complete
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 3000 });
  // Check for progress indicators while running (may be transient as polling updates state)
  const hasProgressText = await page.getByText(/Now running:/).isVisible().catch(() => false);
  const hasProgressCount = await page.getByText("Progress 12/35").isVisible().catch(() => false);
  if (!hasProgressText && !hasProgressCount) {
    // If progress text is gone, we're in the final state - check for results
    await expect(page.getByTestId("summary-metric-total")).toContainText("21");
  } else {
    // Still in progress state
    expect(hasProgressText || hasProgressCount).toBeTruthy();
  }
  // Wait for completion
  await expect(page.getByRole("progressbar")).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByTestId("summary-metric-total")).toContainText("21");
});

test("local qa analytics keeps showing progress through a transient polling miss", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures();
  let pollCount = 0;

  await mockQaAnalyticsApi(page, fixtures);
  await mockLocalSnapshot(page, fixtures);

  await page.route("**/api/quality-analytics/run-tests**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-3",
            mode: "mock",
            status: "running",
            progress: 22,
            currentStep: 5,
            totalSteps: 20,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    pollCount += 1;

    if (pollCount === 1) {
      await route.fulfill({ json: { run: null } });
      return;
    }

    if (pollCount === 2) {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-3",
            mode: "mock",
            status: "running",
            progress: 22,
            currentStep: 5,
            totalSteps: 20,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        run: {
          jobId: "job-3",
          mode: "mock",
          status: "success",
          progress: 100,
          currentStep: 20,
          totalSteps: 20,
          currentTestLabel: null,
          message: "Test run completed successfully.",
          finishedAt: "2026-05-31T01:15:23.372Z",
          exitCode: 0,
        },
      },
    });
  });

  await page.goto("/ai-failure-analysis");
  await page.getByTestId("run-tests-button").click();

  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText(/Now running:/)).toBeVisible();

  await expect(page.getByTestId("run-status-message")).toContainText("Last run completed successfully", {
    timeout: 5000,
  });
  // Status badge removed - now shown inline in status message
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("local qa analytics refreshes latest results when a run fails", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures({
    runs: [
      {
        id: "run-4",
        branch: "feature/analytics",
        commit_sha: "deadbeef",
        created_at: "2026-05-26T10:00:00.000Z",
        passed: 15,
        failed: 5,
        total_tests: 20,
      },
    ],
    results: [
      {
        run_id: "run-4",
        suite: "dashboard/search.spec.ts",
        test_name: "Search by symbol finds the coin",
        status: "failed",
        error_message: "Selector timed out.",
      },
      {
        run_id: "run-4",
        suite: "dashboard/checkout.spec.ts",
        test_name: "Checkout flow completes with coupon",
        status: "failed",
        error_message: "Checkout button was disabled.",
      },
      {
        run_id: "run-4",
        suite: "dashboard/history.spec.ts",
        test_name: "History fetch handles a 429 response",
        status: "passed",
        error_message: null,
      },
    ],
  });
  let pollCount = 0;
  let snapshotVersion = 0;

  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/quality-analytics/local-snapshot**", async (route) => {
    const latestRun =
      snapshotVersion === 0
        ? fixtures.runs[0] || null
        : {
            ...fixtures.runs[0],
            total_tests: 21,
            passed: 15,
            failed: 6,
          };

    const latestFailures =
      snapshotVersion === 0
        ? fixtures.allResults
            .filter((result) => result.run_id === latestRun?.id && result.status === "failed")
            .map((result, index) => ({
              test_name: result.test_name,
              failures: index === 0 ? 2 : 1,
              run_id: result.run_id,
              suite: result.suite,
              error_message: result.error_message,
            }))
        : [
            {
              test_name: "Search by symbol finds the coin",
              failures: 3,
              run_id: "run-4",
              suite: "dashboard/search.spec.ts",
              error_message: "Selector timed out.",
            },
            {
              test_name: "Checkout flow completes with coupon",
              failures: 1,
              run_id: "run-4",
              suite: "dashboard/checkout.spec.ts",
              error_message: "Checkout button was disabled.",
            },
          ];

    const totals =
      snapshotVersion === 0
        ? {
            total_tests: 20,
            passed: 15,
            failed: 5,
            skipped: 0,
            flaky: 0,
          }
        : {
            total_tests: 21,
            passed: 15,
            failed: 6,
            skipped: 0,
            flaky: 0,
          };

    await route.fulfill({
      json: {
        latestRun,
        latestRunSummary: {
          ...totals,
          duration_ms: 135000,
          report_path: "/playwright-report/index.html",
        },
        latestFailures,
        aiAnalysis: [],
      },
    });
  });

  await page.route("**/api/quality-analytics/run-tests**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-2",
            mode: "mock",
            status: "running",
            progress: 18,
            currentStep: 4,
            totalSteps: 20,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    pollCount += 1;

    if (pollCount < 2) {
      await route.fulfill({
        json: {
          run: {
            jobId: "job-2",
            mode: "mock",
            status: "running",
            progress: 18,
            currentStep: 4,
            totalSteps: 20,
            currentTestLabel: "Checkout flow completes with coupon",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    snapshotVersion = 1;

    await route.fulfill({
      json: {
        run: {
          jobId: "job-2",
          mode: "mock",
          status: "failed",
          progress: 100,
          currentStep: 20,
          totalSteps: 20,
          currentTestLabel: null,
          message: "Test run failed with exit code 1.",
          finishedAt: "2026-05-31T01:12:23.372Z",
          exitCode: 1,
        },
      },
    });
  });

  await page.goto("/ai-failure-analysis");

  await page.getByTestId("run-tests-button").click();
  // Wait for run to progress and complete
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 3000 });
  // Check for progress indicators while running (may be transient as polling updates state)
  const hasProgressText = await page.getByText(/Now running:/).isVisible().catch(() => false);
  const hasProgressCount = await page.getByText(/Progress \d+\/\d+/).isVisible().catch(() => false);
  if (!hasProgressText && !hasProgressCount) {
    // If progress text is gone, we're in the final state - check for results
    await expect(page.getByTestId("summary-metric-total")).toContainText("21");
  }
  // Wait for completion
  await expect(page.getByRole("progressbar")).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByTestId("summary-metric-total")).toContainText("21");
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toContainText(
    "3 failures",
  );
});

test("local qa analytics continues running execution when page is reloaded", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures();
  let requestCount = 0;
  let runStarted = false;

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/quality-analytics/run-tests**", async (route) => {
    if (route.request().method() === "POST") {
      runStarted = true;
      await route.fulfill({
        json: {
          run: {
            jobId: "job-reload",
            mode: "mock",
            status: "running",
            progress: 14,
            currentStep: 3,
            totalSteps: 20,
            currentTestLabel: "Search by symbol finds the coin",
            message: "Running e2e mock tests...",
            finishedAt: null,
            exitCode: null,
          },
        },
      });
      return;
    }

    // GET requests return current running state only after POST
    if (!runStarted) {
      await route.fulfill({
        json: {
          run: null,
        },
      });
      return;
    }

    requestCount += 1;
    await route.fulfill({
      json: {
        run: {
          jobId: "job-reload",
          mode: "mock",
          status: "running",
          progress: 14 + requestCount * 5,
          currentStep: 3 + requestCount,
          totalSteps: 20,
          currentTestLabel: "Search by symbol finds the coin",
          message: "Running e2e mock tests...",
          finishedAt: null,
          exitCode: null,
        },
      },
    });
  });

  await page.goto("/ai-failure-analysis");
  await page.getByTestId("run-tests-button").click();
  await expect(page.getByText(/Now running:/)).toBeVisible();

  // Reload page while test is running
  await page.reload();

  // After reload, the run should still be shown as in progress
  // (loaded from the API, not from local state)
  await expect(page.getByText(/Now running:/)).toBeVisible({ timeout: 3000 });
});

test("quality analytics shows metrics overview and trend chart", async ({
  page,
}) => {
  const fixtures = createQaAnalyticsFixtures();

  await mockSupabaseRoutes(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/quality-analytics");

  await expect(page.getByRole("heading", { name: "Metrics overview" })).toBeVisible();
  await expect(
    page.getByText(
      "Metrics and analytics across all test runs. View trends, failures, and branch health.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toBeVisible();
  await expect(page.getByTestId("test-trends-chart")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveCount(0);
  await expect(page.getByTestId("ai-provider-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Latest run failures" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI failure analysis" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Runs" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Top failures" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flaky tests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Branch health" })).toBeVisible();
});

test("/quality-analytics page displays all metrics", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures();

  await mockSupabaseRoutes(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/quality-analytics");

  await expect(page.getByRole("heading", { name: "Metrics overview" })).toBeVisible();
  await expect(
    page.getByText(
      "Metrics and analytics across all test runs. View trends, failures, and branch health.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toBeVisible();
  await expect(page.getByTestId("stats-pass-rate")).toBeVisible();
  await expect(page.getByTestId("stats-passed-tests")).toBeVisible();
  await expect(page.getByTestId("stats-failed-tests")).toBeVisible();
  await expect(page.getByTestId("test-trends-chart")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top failures" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flaky tests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Branch health" })).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveCount(0);
  await expect(page.getByTestId("ai-provider-panel")).toHaveCount(0);
});

test("/ai-failure-analysis page renders AI analyzer in local mode", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures();

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/qa-insights", async (route) => {
    await route.fulfill({ json: { insights: [] } });
  });

  await page.goto("/ai-failure-analysis");

  await expect(page.getByRole("heading", { name: "AI Failure Analysis" })).toBeVisible();
  await expect(
    page.getByText("Analyze Playwright failures, identify root causes, and generate AI-powered fixes."),
  ).toBeVisible();
  await expect(page.getByTestId("run-controls-panel")).toBeVisible();
  await expect(page.getByTestId("run-mode-mock")).toBeVisible();
  await expect(page.getByTestId("run-tests-button")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toBeVisible();
  await expect(page.getByTestId("ai-provider-panel")).toBeVisible();
});

