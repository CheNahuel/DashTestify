import { expect, test, type Page } from "@playwright/test";

type SupabaseRow = Record<string, unknown>;

type TestResultFixture = {
  run_id: string;
  suite: string;
  test_name: string | null;
  status: string;
  error_message: string | null;
};

function createSupabaseFixtures(options?: {
  analyses?: SupabaseRow[];
}) {
  const runs = [
    {
      id: "run-2",
      branch: "main",
      commit_sha: "abcdef1234567890",
      created_at: "2026-05-24T10:00:00.000Z",
      passed: 18,
      failed: 2,
      total_tests: 20,
    },
    {
      id: "run-1",
      branch: "feature/analytics",
      commit_sha: "fedcba0987654321",
      created_at: "2026-05-23T10:00:00.000Z",
      passed: 16,
      failed: 4,
      total_tests: 20,
    },
  ];

  const allResults: TestResultFixture[] = [
    {
      run_id: "run-2",
      suite: "dashboard/search.spec.ts",
      test_name: "Search by symbol finds the coin",
      status: "passed",
      error_message: null,
    },
    {
      run_id: "run-1",
      suite: "dashboard/search.spec.ts",
      test_name: "Search by symbol finds the coin",
      status: "failed",
      error_message: "Timeout waiting for selector [data-testid=\"search-input\"]",
    },
    {
      run_id: "run-1",
      suite: "dashboard/search.spec.ts",
      test_name: "Search by name filters coins and selects match",
      status: "failed",
      error_message: "Expected 1 result but saw 0.",
    },
    {
      run_id: "run-2",
      suite: "dashboard/search.spec.ts",
      test_name: "Search by name filters coins and selects match",
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
    {
      run_id: "run-1",
      suite: "dashboard/error.spec.ts",
      test_name: "History fetch handles a 429 response",
      status: "failed",
      error_message: "Rate limit exceeded.",
    },
  ];

  const aiAnalyses = options?.analyses ?? [];

  return { runs, allResults, aiAnalyses };
}

async function mockAnalyticsData(page: Page, fixtures: ReturnType<typeof createSupabaseFixtures>) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.includes("/test_runs")) {
      await route.fulfill({ json: fixtures.runs });
      return;
    }

    if (url.pathname.includes("/ai_analysis")) {
      await route.fulfill({ json: fixtures.aiAnalyses });
      return;
    }

    if (url.pathname.includes("/test_results")) {
      const isFailedOnly = url.searchParams.get("status") === "eq.failed";
      const payload = isFailedOnly
        ? fixtures.allResults.filter((result) => result.status === "failed")
        : fixtures.allResults;

      await route.fulfill({ json: payload });
      return;
    }

    await route.continue();
  });
}

test("analytics page shows runs, failures, and can generate AI analysis with a selected provider", async ({
  page,
}) => {
  const fixtures = createSupabaseFixtures();

  await mockAnalyticsData(page, fixtures);

  await page.route("**/api/analytics/ai", async (route) => {
    const body = route.request().postDataJSON() as {
      action: string;
      provider?: string;
      failures?: Array<{ testName: string }>;
      analysisId?: string;
    };

    if (body.action === "analyze") {
      const firstFailure = body.failures?.[0];

      await route.fulfill({
        json: {
          provider: body.provider,
          skipped: [],
          analyses: [
            {
              id: "42",
              test_name: firstFailure?.testName || "Search by symbol finds the coin",
              ai_summary: `Gemini found a fragile selector in ${firstFailure?.testName || "the failing test"}.`,
              suggested_fix: "Switch the test to a stable data-testid selector.",
              severity: "high",
              classification: "test_issue",
              confidence: 96,
              target_file: "tests/e2e/dashboard/search.spec.ts",
              generated_patch:
                "diff --git a/tests/e2e/dashboard/search.spec.ts b/tests/e2e/dashboard/search.spec.ts\n--- a/tests/e2e/dashboard/search.spec.ts\n+++ b/tests/e2e/dashboard/search.spec.ts\n@@ -1 +1 @@\n-old selector\n+new selector",
            },
          ],
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

  await page.goto("/analytics");

  await expect(page.getByRole("heading", { name: "Test health, failures, and AI fixes" })).toBeVisible();
  await expect(page.getByTestId("stats-total-runs")).toContainText("2");
  await expect(page.getByTestId("stats-failed-tests")).toContainText("6");

  await expect(page.getByTestId("failing-test-search-by-symbol-finds-the-coin")).toBeVisible();
  await expect(page.getByTestId("failing-test-history-fetch-handles-a-429-response")).toBeVisible();

  await page.getByTestId("ai-provider-select").selectOption("gemini");
  const failingCard = page.getByTestId("failing-test-search-by-symbol-finds-the-coin");
  const providerButton = failingCard.getByRole("button", { name: "Analyze with Gemini" });

  await expect(providerButton).toBeVisible();

  const cardBox = await failingCard.boundingBox();
  const buttonBox = await providerButton.boundingBox();

  expect(cardBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 2);

  await page.getByTestId("ai-auto-apply-all").click();

  await expect(page.getByTestId("ai-status-message")).toContainText("Gemini");
  await expect(page.getByTestId("ai-status-message")).toContainText("Auto-applied 1 high-confidence fix");
  await expect(page.getByTestId("ai-analysis-card-42")).toBeVisible();
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText(
    "fragile selector",
  );
  await expect(page.getByTestId("ai-analysis-card-42")).toContainText("Apply AI fix");
});

test("analytics page can apply an AI fix from an existing analysis card", async ({ page }) => {
  const fixtures = createSupabaseFixtures({
    analyses: [
      {
        id: "42",
        test_name: "Search by symbol finds the coin",
        ai_summary: "The selector is brittle and should target the stable search input.",
        suggested_fix: "Update the selector to the search input test id.",
        severity: "high",
        classification: "test_issue",
        confidence: 96,
        target_file: "tests/e2e/dashboard/search.spec.ts",
        generated_patch:
          "diff --git a/tests/e2e/dashboard/search.spec.ts b/tests/e2e/dashboard/search.spec.ts\n--- a/tests/e2e/dashboard/search.spec.ts\n+++ b/tests/e2e/dashboard/search.spec.ts\n@@ -1 +1 @@\n-old selector\n+new selector",
      },
    ],
  });

  await mockAnalyticsData(page, fixtures);

  await page.route("**/api/analytics/ai", async (route) => {
    const body = route.request().postDataJSON() as { action: string; analysisId?: string };

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

  await page.goto("/analytics");

  await expect(page.getByTestId("ai-analysis-card-42")).toBeVisible();

  await page.getByTestId("ai-apply-42").click();

  await expect(page.getByTestId("ai-status-message")).toContainText("locally on feature/source");
  await expect(page.getByTestId("ai-status-message")).toContainText(
    "tests/e2e/dashboard/search.spec.ts",
  );
});

test("analytics page tolerates failing tests with a missing test name", async ({ page }) => {
  const fixtures = createSupabaseFixtures();
  const missingNameResults: TestResultFixture[] = [
    {
      run_id: "run-1",
      suite: "dashboard/search.spec.ts",
      test_name: null,
      status: "failed",
      error_message: "Missing test name should not crash the page.",
    },
  ];

  fixtures.allResults = missingNameResults;

  await mockAnalyticsData(page, fixtures);

  await page.route("**/api/analytics/ai", async (route) => {
    await route.fulfill({ json: { error: "Unsupported action." }, status: 400 });
  });

  await page.goto("/analytics");

  await expect(page.getByText("Unknown test")).toBeVisible();
  await expect(page.getByTestId("failing-test-unknown-test-1")).toBeVisible();
});
