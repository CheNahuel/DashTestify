import { expect, test, type Page } from "@playwright/test";

import { buildLocalQaAnalyticsSnapshot } from "@/lib/qa-analytics/local-results";

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

async function mockLocalSnapshot(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/api/qa-analytics/local-snapshot**", async (route) => {
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

    const totals = fixtures.allResults.filter((result) => result.run_id === latestRun.id).reduce(
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

  await page.route("**/api/qa-analytics/local-ai", async (route) => {
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

  await expect(page.getByRole("heading", { name: "Latest local run", exact: true })).toBeVisible();
  await expect(page.getByText(/Last run results:/)).toBeVisible();
  await expect(page.getByText(/passed/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Playwright report" })).toHaveAttribute(
    "href",
    "/playwright-report/index.html",
  );
  await expect(page.getByText(/Branch:/)).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toHaveValue("gemini");
  const titleBox = await page.getByRole("heading", { name: "Latest local run", exact: true }).boundingBox();
  const providerBox = await page.getByTestId("ai-provider-select").boundingBox();

  expect(titleBox).not.toBeNull();
  expect(providerBox).not.toBeNull();
  expect(providerBox!.y).toBeGreaterThan((titleBox!.y || 0) + (titleBox!.height || 0));
  await expect(
    page.getByText("Use the run controls to execute Playwright locally, then analyze the latest run or a single failure."),
  ).toBeVisible();
  await expect(page.getByTestId("ai-analyze-all")).toContainText("Analyze latest run failures");
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
  await expect(page.getByRole("button", { name: "Analyze this failure only" })).toHaveCount(2);
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
  await expect(page.getByText("Historical analysis should not appear in the latest local run view.")).toHaveCount(0);
});

test("local qa analytics prompts to run Playwright when no local run is available", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures({
    runs: [],
    results: [],
    trends: [],
  });

  await mockLocalSnapshot(page, fixtures);
  await mockQaAnalyticsApi(page, fixtures);

  await page.goto("/qa-analytics");

  await expect(page.getByText("No local run found")).toBeVisible();
  await expect(page.getByText("Run your Playwright suite locally and sync the latest results")).toBeVisible();
  await expect(page.getByTestId("ai-provider-select")).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toHaveCount(0);
  await expect(page.getByTestId("test-trends-chart")).toHaveCount(0);
});

test("local qa analytics renders duplicate unknown failures with unique cards", async ({ page }) => {
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

  await page.goto("/qa-analytics");

  await expect(page.getByTestId("failing-test-unknown-test-1")).toBeVisible();
  await expect(page.getByTestId("failing-test-unknown-test-2")).toBeVisible();
  await expect(page.getByTestId("failing-test-unknown-test-1")).toContainText("First unknown failure.");
  await expect(page.getByTestId("failing-test-unknown-test-2")).toContainText("Second unknown failure.");
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

test("local qa analytics can start a mock run and shows progress before success", async ({ page }) => {
  const fixtures = createQaAnalyticsFixtures();
  let pollCount = 0;
  let snapshotVersion = 0;

  await mockQaAnalyticsApi(page, fixtures);

  await page.route("**/api/qa-analytics/local-snapshot**", async (route) => {
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
        ? fixtures.allResults.filter((result) => result.run_id === latestRun?.id).reduce(
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
          report_path: "/playwright-report/index.html",
        },
        latestFailures,
        aiAnalysis: [],
      },
    });
  });

  await page.route("**/api/qa-analytics/run-tests**", async (route) => {
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
          message: "Test run completed successfully.",
          finishedAt: "2026-05-31T01:10:23.372Z",
          exitCode: 0,
        },
      },
    });
  });

  await page.goto("/qa-analytics");

  await expect(page.getByTestId("run-tests-mode-select")).toHaveValue("mock");
  await page.getByTestId("run-tests-button").click();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText(/E2E mock is running/)).toBeVisible();
  await expect(page.getByTestId("run-status-message")).toContainText("Running e2e mock mode");
  await expect(page.getByTestId("run-status-message")).toContainText("Report success");
  await expect(page.getByText(/21 total/)).toBeVisible();
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

  await page.route("**/api/qa-analytics/local-snapshot**", async (route) => {
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
          report_path: "/playwright-report/index.html",
        },
        latestFailures,
        aiAnalysis: [],
      },
    });
  });

  await page.route("**/api/qa-analytics/run-tests**", async (route) => {
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
          message: "Test run failed with exit code 1.",
          finishedAt: "2026-05-31T01:12:23.372Z",
          exitCode: 1,
        },
      },
    });
  });

  await page.goto("/qa-analytics");

  await page.getByTestId("run-tests-button").click();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByTestId("run-status-message")).toContainText("Running e2e mock mode");
  await expect(page.getByTestId("run-status-message")).toContainText("Report failed (6 failures)");
  await expect(page.getByText(/21 total/)).toBeVisible();
  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toContainText("3 failures");
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
