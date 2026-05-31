export type PlaywrightJsonResult = {
  status?: string;
  duration?: number;
  retry?: number;
  startTime?: string;
  errors?: Array<{ message?: string }>;
};

export type PlaywrightJsonTest = {
  title?: string;
  status?: string;
  results?: PlaywrightJsonResult[];
};

export type PlaywrightJsonSpec = {
  title?: string;
  file?: string;
  tests?: PlaywrightJsonTest[];
};

export type PlaywrightJsonSuite = {
  title?: string;
  file?: string;
  specs?: PlaywrightJsonSpec[];
};

export type PlaywrightJsonFile = {
  stats?: {
    startTime?: string;
    duration?: number;
    expected?: number;
    unexpected?: number;
    skipped?: number;
    flaky?: number;
  };
  suites?: PlaywrightJsonSuite[];
};

type LocalGitState = {
  branch: string;
  commitSha: string | null;
};

type StoredAiAnalysis = {
  run_id: string;
  created_at: string;
  test_name: string;
  error_message?: string | null;
  ai_summary: string;
  suggested_fix: string;
  severity: string;
  classification: string;
  confidence: number;
  target_file: string | null;
  generated_patch: string | null;
  id: string;
};

type LocalLatestFailure = {
  test_name: string;
  failures: number;
  run_id: string;
  suite: string;
  error_message: string | null;
};

type LocalTestRun = {
  id: string;
  branch: string;
  commit_sha: string | null;
  created_at: string;
  passed: number;
  failed: number;
  total_tests: number;
};

type LocalRunSummary = {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration_ms: number | null;
  report_path: string;
};

export type LocalQaAnalyticsSnapshot = {
  latestRun: LocalTestRun | null;
  latestRunSummary: LocalRunSummary | null;
  latestFailures: LocalLatestFailure[];
  aiAnalysis: StoredAiAnalysis[];
};

function getResultMessage(result: PlaywrightJsonResult | undefined) {
  const fromErrors = result?.errors?.[0]?.message?.trim();

  if (fromErrors) {
    return fromErrors;
  }

  return null;
}

function getTestName(spec: PlaywrightJsonSpec, test: PlaywrightJsonTest, fallbackIndex: number) {
  return test.title?.trim() || spec.title?.trim() || spec.file?.trim() || `Unknown test ${fallbackIndex}`;
}

function getSuiteName(suite: PlaywrightJsonSuite, spec: PlaywrightJsonSpec) {
  return suite.title?.trim() || spec.file?.trim() || suite.file?.trim() || "Unknown suite";
}

export function buildLocalQaAnalyticsSnapshot({
  resultsFile,
  aiAnalysesFile,
  gitState,
  currentTime = new Date().toISOString(),
}: {
  resultsFile: PlaywrightJsonFile | null;
  aiAnalysesFile: StoredAiAnalysis[] | null;
  gitState: LocalGitState;
  currentTime?: string;
}): LocalQaAnalyticsSnapshot {
  const stats = resultsFile?.stats;
  const suites = resultsFile?.suites || [];
  const runId = `local-${stats?.startTime || "latest-run"}`;
  const createdAt = stats?.startTime || currentTime;

  const failuresByKey = new Map<string, LocalLatestFailure>();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let flaky = 0;

  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const [index, test] of (spec.tests || []).entries()) {
        const testName = getTestName(spec, test, index + 1);
        const suiteName = getSuiteName(suite, spec);
        const resultStatus = test.results?.[0]?.status;

        if (resultStatus === "passed" || test.status === "expected") {
          passed += 1;
          continue;
        }

        if (resultStatus === "skipped" || test.status === "skipped") {
          skipped += 1;
          continue;
        }

        if (resultStatus === "flaky" || test.status === "flaky") {
          flaky += 1;
          continue;
        }

        failed += 1;

        const key = `${suiteName}::${testName}`;
        const latestResult = [...(test.results || [])].reverse().find((result) => result.status !== "passed");
        const errorMessage = getResultMessage(latestResult) || getResultMessage(test.results?.[0]) || null;

        const existing = failuresByKey.get(key);
        if (!existing) {
          failuresByKey.set(key, {
            test_name: testName,
            failures: 1,
            run_id: runId,
            suite: suiteName,
            error_message: errorMessage,
          });
          continue;
        }

        existing.failures += 1;
        existing.error_message = errorMessage || existing.error_message;
      }
    }
  }

  const latestRun: LocalTestRun | null = resultsFile
    ? {
        id: runId,
        branch: gitState.branch,
        commit_sha: gitState.commitSha,
        created_at: createdAt,
        passed,
        failed,
        total_tests: passed + failed + skipped + flaky,
      }
    : null;

  const localAnalyses = resultsFile
    ? (aiAnalysesFile || [])
        .filter((analysis) => analysis.run_id === runId)
        .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""))
    : [];

  return {
    latestRun,
      latestRunSummary: latestRun
      ? {
          total_tests: latestRun.total_tests,
          passed,
          failed,
          skipped,
          flaky,
          duration_ms: typeof stats?.duration === "number" ? stats.duration : null,
          report_path: "/playwright-report/index.html",
        }
      : null,
    latestFailures: [...failuresByKey.values()].sort((left, right) => right.failures - left.failures),
    aiAnalysis: localAnalyses,
  };
}
