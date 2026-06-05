import fs from "fs/promises";
import os from "os";
import path from "path";
import { type Page } from "@playwright/test";

export type SupabaseRow = Record<string, unknown>;

export type TestResultFixture = {
  run_id: string;
  suite: string;
  test_name: string | null;
  status: string;
  error_message: string | null;
};

export type QaAnalyticsFixtures = {
  runs: SupabaseRow[];
  allResults: TestResultFixture[];
  aiAnalyses: SupabaseRow[];
  trends: SupabaseRow[];
  latestRun?: SupabaseRow | null;
  latestRunSummary?: Record<string, unknown> | null;
  latestFailures?: SupabaseRow[];
};

const runStatePath = path.join(os.tmpdir(), "dash-testify-qa-analytics", "run-tests-state.json");
const localAnalysesPath = path.join(
  os.tmpdir(),
  "dash-testify-qa-analytics",
  "qa-analytics-ai.json",
);

export async function cleanupAnalysesPath() {
  await fs.rm(localAnalysesPath, { force: true });
  await fs.rm(runStatePath, { force: true });
}

export function createQaAnalyticsFixtures(options?: {
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

export async function mockQaAnalyticsApi(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/api/qa-analytics/test-trends**", async (route) => {
    await route.fulfill({ json: { data: fixtures.trends, days: 30 } });
  });
}

export async function mockLocalSnapshot(page: Page, fixtures: QaAnalyticsFixtures) {
  await page.route("**/api/qa-analytics/local-snapshot**", async (route) => {
    const latestRun = fixtures.latestRun ?? fixtures.runs[0] ?? null;

    if (!latestRun) {
      await route.fulfill({
        json: {
          latestRun: null,
          latestRunSummary: null,
          latestFailures: [],
          aiAnalysis: fixtures.aiAnalyses || [],
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
        latestRunSummary: fixtures.latestRunSummary ?? {
          ...totals,
          duration_ms: 126000,
          report_path: "/playwright-report/index.html",
        },
        latestFailures: fixtures.latestFailures ?? latestFailures,
        aiAnalysis: fixtures.aiAnalyses || [],
      },
    });
  });
}
