"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { AiProvider, LatestLocalFailure, LocalAiAnalysis, LocalTestRun } from "@/components/qa-analytics/types";

const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

const ACTIONABLE_CONFIDENCE_THRESHOLD = 80;

function normalizeTestId(value: string | null | undefined, fallback = "unknown-test") {
  const normalized = value?.trim() ? value.trim() : fallback;

  return normalized.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function buildFailureCardKey(test: LatestLocalFailure, index: number) {
  const displayName = test.test_name?.trim() || "Unknown test";
  const suiteName = test.suite?.trim() || "Unknown suite";
  const errorMessage = test.error_message?.trim() || "No error message captured.";

  return [
    normalizeTestId(displayName, "unknown-test"),
    normalizeTestId(suiteName, "unknown-suite"),
    normalizeTestId(String(test.run_id), "unknown-run"),
    normalizeTestId(errorMessage, "unknown-error"),
    index + 1,
  ].join(":");
}

function formatAnalysisGroupKey(analysis: Pick<LocalAiAnalysis, "test_name" | "target_file" | "error_message">) {
  const testName = normalizeTestId(analysis.test_name, "unknown-test");
  const targetFile = normalizeTestId(analysis.target_file, "unknown-file");
  const errorMessage = normalizeTestId(analysis.error_message, "unknown-error");

  return `${testName}::${targetFile}::${errorMessage}`;
}

function isActionableAnalysis(analysis: LocalAiAnalysis) {
  return (
    analysis.classification === "test_issue" &&
    analysis.confidence >= ACTIONABLE_CONFIDENCE_THRESHOLD &&
    Boolean(analysis.generated_patch)
  );
}

function getRunStatusMessage(runState: QaAnalyticsRunState, latestRunSummary: LocalRunSummary | null) {
  if (runState.status === "running") {
    return `Running e2e ${runState.mode} mode...`;
  }

  if (runState.status === "success") {
    return "Report success. Latest results refreshed.";
  }

  if (runState.status === "failed") {
    const failedCount = latestRunSummary?.failed;

    return typeof failedCount === "number"
      ? `Report failed (${failedCount} failures). Latest results refreshed.`
      : "Report failed. Latest results refreshed.";
  }

  return runState.message;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function collapseAiAnalyses(analyses: LocalAiAnalysis[]) {
  const grouped = analyses.reduce<Record<string, LocalAiAnalysis[]>>((acc, analysis) => {
    const key = formatAnalysisGroupKey(analysis);

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(analysis);
    return acc;
  }, {});

  return Object.values(grouped)
    .map((group) => {
      const ordered = [...group].sort((left, right) => {
        const actionableDiff = Number(isActionableAnalysis(right)) - Number(isActionableAnalysis(left));

        if (actionableDiff !== 0) {
          return actionableDiff;
        }

        const confidenceDiff = right.confidence - left.confidence;

        if (confidenceDiff !== 0) {
          return confidenceDiff;
        }

        return toTimestamp(right.created_at) - toTimestamp(left.created_at);
      });

      return {
        primary: ordered[0],
        alternatives: ordered.slice(1),
      };
    })
    .sort((left, right) => {
      const actionableDiff = Number(isActionableAnalysis(right.primary)) - Number(isActionableAnalysis(left.primary));

      if (actionableDiff !== 0) {
        return actionableDiff;
      }

      const confidenceDiff = right.primary.confidence - left.primary.confidence;

      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      return toTimestamp(right.primary.created_at) - toTimestamp(left.primary.created_at);
    });
}

type LocalQaAnalyticsPageProps = {
  currentBranch: string;
};

type LocalRunSummary = {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  report_path: string;
};

type LocalSnapshot = {
  latestRun: LocalTestRun | null;
  latestRunSummary: LocalRunSummary | null;
  latestFailures: LatestLocalFailure[];
  aiAnalysis: LocalAiAnalysis[];
  error?: string;
};

type QaAnalyticsRunMode = "mock" | "live";

type QaAnalyticsRunState = {
  jobId: string;
  mode: QaAnalyticsRunMode;
  status: "idle" | "running" | "success" | "failed";
  progress: number;
  currentStep: number | null;
  totalSteps: number | null;
  message: string;
  finishedAt: string | null;
  exitCode: number | null;
};

export function LocalQaAnalyticsPage({ currentBranch }: LocalQaAnalyticsPageProps) {
  const mountedRef = useRef(true);
  const refreshedJobIdRef = useRef<string | null>(null);
  const [latestRun, setLatestRun] = useState<LocalTestRun | null>(null);
  const [latestRunSummary, setLatestRunSummary] = useState<LocalRunSummary | null>(null);
  const [latestFailures, setLatestFailures] = useState<LatestLocalFailure[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<LocalAiAnalysis[]>([]);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("gemini");
  const [selectedRunMode, setSelectedRunMode] = useState<QaAnalyticsRunMode>("mock");
  const [runState, setRunState] = useState<QaAnalyticsRunState | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLocalSnapshot(options?: { showLoading?: boolean; cacheBust?: boolean }) {
    const showLoading = options?.showLoading ?? false;
    const cacheBust = options?.cacheBust ?? false;

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/qa-analytics/local-snapshot${cacheBust ? `?t=${Date.now()}` : ""}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as LocalSnapshot;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load the local QA Analytics snapshot.");
      }

      if (!mountedRef.current) {
        return;
      }

      setLatestRun(data.latestRun);
      setLatestRunSummary(data.latestRunSummary);
      setLatestFailures(data.latestFailures || []);
      setAiAnalysis(data.aiAnalysis || []);
      setActionStatus(null);

      return data;
    } catch (error) {
      console.error(error);

      if (mountedRef.current) {
        setLatestRun(null);
        setLatestRunSummary(null);
        setLatestFailures([]);
        setAiAnalysis([]);
        setActionStatus("Unable to load local QA Analytics from test-results/results.json.");
      }

      return null;
    } finally {
      if (mountedRef.current && showLoading) {
        setIsLoading(false);
      }
    }
  }

  async function loadRunState() {
    try {
      const response = await fetch("/api/qa-analytics/run-tests");
      const data = (await response.json()) as { run: QaAnalyticsRunState | null };

      if (!response.ok) {
        return;
      }

      if (mountedRef.current) {
        setRunState(data.run);
      }
    } catch {
      if (mountedRef.current) {
        setRunState(null);
      }
    }
  }

  async function refreshLatestRunAfterCompletion(run: QaAnalyticsRunState) {
    if (refreshedJobIdRef.current === run.jobId) {
      return;
    }

    refreshedJobIdRef.current = run.jobId;

    const retryDelays = [0, 600, 1400];
    let latestSnapshot: LocalSnapshot | null = null;

    for (const delay of retryDelays) {
      if (!mountedRef.current) {
        return;
      }

      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }

      latestSnapshot = await loadLocalSnapshot({ cacheBust: true });
    }

    if (mountedRef.current) {
      const failedCount = latestSnapshot?.latestRunSummary?.failed ?? latestRunSummary?.failed ?? null;
      const terminalMessage =
        run.status === "success"
          ? "Report success. Latest results refreshed."
          : failedCount === null
            ? "Report failed. Latest results refreshed."
            : `Report failed (${failedCount} failures). Latest results refreshed.`;

      setRunState((current) =>
        current?.jobId === run.jobId ? { ...current, message: terminalMessage } : current,
      );
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    void loadLocalSnapshot({ showLoading: true });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (runState?.status !== "running") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void loadRunState();
    }, 1500);

    return () => window.clearInterval(timer);
  }, [runState?.status]);

  useEffect(() => {
    if (runState?.status === "success" || runState?.status === "failed") {
      void refreshLatestRunAfterCompletion(runState);
    }
  }, [runState?.status, runState?.jobId]);

  async function sendAiAction(payload: unknown) {
    setBusyAction("ai-action");
    setActionStatus(null);

    try {
      const response = await fetch("/api/qa-analytics/local-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        analyses?: LocalAiAnalysis[];
        provider?: string;
        skipped?: string[];
        branchName?: string;
        applyMode?: "local" | "branch";
        committed?: boolean;
        filePath?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "AI action failed.");
      }

      return data;
    } finally {
      setBusyAction(null);
    }
  }

  async function startTestRun(mode: QaAnalyticsRunMode) {
    setIsStartingRun(true);

    try {
      const response = await fetch("/api/qa-analytics/run-tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      });

      const data = (await response.json()) as {
        error?: string;
        run?: QaAnalyticsRunState;
      };

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || "Unable to start the test run.");
      }

      if (data.run) {
        setRunState(data.run);
      }

      if (response.status === 409) {
        setActionStatus("A test run is already in progress.");
      }
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Unable to start the test run.");
    } finally {
      setIsStartingRun(false);
    }
  }

  async function runAnalysis(targetFailures: LatestLocalFailure[]) {
    setAnalysisRequested(true);

    if (targetFailures.length === 0 || !latestRun) {
      setActionStatus("No local run is available yet. Run Playwright locally to populate this view.");
      setAiAnalysis([]);
      return [] as LocalAiAnalysis[];
    }

    const payload = {
      action: "analyze" as const,
      provider: selectedProvider,
      failures: targetFailures.map((failure) => ({
        runId: failure.run_id,
        testName: failure.test_name || "Unknown test",
        suite: failure.suite,
        errorMessage: failure.error_message || "",
      })),
    };

    try {
      const result = await sendAiAction(payload);
      const insertedAnalyses = (result?.analyses || []) as LocalAiAnalysis[];

      if (insertedAnalyses.length > 0) {
        setAiAnalysis((current) => {
          const seenIds = new Set(current.map((analysis) => analysis.id));
          const nextAnalyses = insertedAnalyses.filter((analysis) => !seenIds.has(analysis.id));

          return [...nextAnalyses, ...current];
        });
      }

      const skippedText = result?.skipped?.length ? ` Skipped ${result.skipped.length} existing analysis row(s).` : "";
      setActionStatus(
        `Created ${insertedAnalyses.length} AI analysis result(s) with ${providerLabels[selectedProvider]}.${skippedText}`,
      );

      return insertedAnalyses;
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "AI analysis failed.");
      return [];
    }
  }

  async function applyAnalysisFix(analysisId: string) {
    try {
      const result = await sendAiAction({
        action: "apply" as const,
        analysisId,
      });

      const location =
        result?.applyMode === "local"
          ? `locally on ${result?.branchName || "the current branch"}`
          : `on ${result?.branchName || "an ai-fix branch"}`;

      setActionStatus(`Applied AI fix ${location} for ${result?.filePath || "the selected file"}.`);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Applying the AI fix failed.");
    }
  }

  const canAnalyze = latestRun !== null && latestFailures.length > 0 && busyAction === null;
  const currentBranchLabel = currentBranch || latestRun?.branch || "unknown branch";
  const localRunMissing = latestRun === null;
  const showAiAnalysisSection = analysisRequested;
  const visibleAiAnalyses = collapseAiAnalyses(aiAnalysis);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">QA Analytics Local</p>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Latest local run</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                  This view shows only the latest Playwright run from your local machine and lets you analyze that run
                  with your local AI keys.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs uppercase tracking-[0.3em] text-slate-400" htmlFor="ai-provider">
                  AI Provider
                </label>

                <Badge variant="secondary">Branch: {currentBranchLabel}</Badge>
              </div>

              <select
                id="ai-provider"
                data-testid="ai-provider-select"
                className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as AiProvider)}
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400" htmlFor="run-mode">
                    Run tests
                  </label>

                  {runState?.status && runState.status !== "idle" && (
                    <Badge
                      variant="outline"
                      className={
                        runState.status === "running"
                          ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                          : runState.status === "success"
                            ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                            : "border-rose-300/30 bg-rose-400/10 text-rose-100"
                      }
                    >
                      {runState.status}
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    id="run-mode"
                    data-testid="run-tests-mode-select"
                    className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
                    value={selectedRunMode}
                    onChange={(event) => setSelectedRunMode(event.target.value as QaAnalyticsRunMode)}
                  >
                    <option value="mock">E2E Mock</option>
                    <option value="live">E2E Live</option>
                  </select>

                  <Button
                    data-testid="run-tests-button"
                    className="w-full sm:w-auto"
                    disabled={isStartingRun || runState?.status === "running"}
                    onClick={() => void startTestRun(selectedRunMode)}
                  >
                    {isStartingRun || runState?.status === "running" ? "Running tests..." : "Run tests"}
                  </Button>
                </div>

                {runState?.status === "running" && (
                  <div className="mt-3 space-y-2">
                    <Progress value={runState.progress || 8} />
                    <p className="text-xs text-slate-400">
                      {runState.mode === "live" ? "E2E live" : "E2E mock"} is running
                      {runState.currentStep && runState.totalSteps
                        ? ` · ${runState.currentStep}/${runState.totalSteps}`
                        : ""}
                      .
                    </p>
                  </div>
                )}

                {runState?.status && runState.status !== "idle" && (
                  <p
                    className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                      runState.status === "success"
                        ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                        : runState.status === "failed"
                          ? "border border-rose-300/20 bg-rose-400/10 text-rose-100"
                          : "border border-white/10 bg-white/5 text-slate-200"
                    }`}
                    data-testid="run-status-message"
                  >
                    {getRunStatusMessage(runState, latestRunSummary)}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                <Button
                  data-testid="ai-analyze-all"
                  className="w-full sm:w-auto"
                  disabled={!canAnalyze}
                  onClick={() => void runAnalysis(latestFailures)}
                >
                  {busyAction ? "Working..." : "Analyze latest run failures"}
                </Button>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                Use the run controls to execute Playwright locally, then analyze the latest run or a single failure.
              </p>

              {actionStatus && (
                <p
                  className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100"
                  data-testid="ai-status-message"
                >
                  {actionStatus}
                </p>
              )}
            </div>
          </div>
        </header>

        {latestRunSummary && !isLoading && (
          <section className="rounded-3xl border border-white/10 bg-slate-950/60 px-5 py-4 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="font-medium text-slate-100">Last run results:</span>

                <Badge
                  variant="outline"
                  className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                >
                  {latestRunSummary.total_tests} total
                </Badge>

                <Badge variant="outline" className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100">
                  {latestRunSummary.passed} passed
                </Badge>

                <Badge variant="outline" className="border-rose-300/30 bg-rose-400/10 text-rose-100">
                  {latestRunSummary.failed} failed
                </Badge>

                <Badge variant="outline" className="border-amber-300/30 bg-amber-400/10 text-amber-100">
                  {latestRunSummary.skipped} skipped
                </Badge>

                <Badge variant="outline" className="border-sky-300/30 bg-sky-400/10 text-sky-100">
                  {latestRunSummary.flaky} flaky
                </Badge>
              </div>

              <a
                href={latestRunSummary.report_path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center self-stretch rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 lg:self-end"
              >
                Open Playwright report
              </a>
            </div>
          </section>
        )}

        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10">
            <h2 className="text-2xl font-semibold text-slate-100">Loading latest local run</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Reading the latest Playwright results from test-results/results.json.
            </p>
          </section>
        ) : localRunMissing ? (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-6 shadow-2xl shadow-amber-950/10">
            <h2 className="text-2xl font-semibold text-amber-100">No local run found</h2>
            <p className="mt-3 max-w-2xl text-sm text-amber-50/80">
              Run your Playwright suite locally and sync the latest results before using QA Analytics Local.
            </p>
          </section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-rose-950/10">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Latest run failures</h2>
                  <p className="text-sm text-slate-400">
                    These are the failures from the most recent local run, which is what AI acts on by default.
                  </p>
                </div>

              </div>

              <div className="space-y-4">
                {latestFailures.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                    No failing tests right now.
                  </p>
                )}

                {latestFailures.map((test, index) => {
                  const displayName = test.test_name?.trim() || "Unknown test";
                  const testId = normalizeTestId(test.test_name, `unknown-test-${index + 1}`);
                  const cardTestId = displayName === "Unknown test" ? `unknown-test-${index + 1}` : testId;

                  return (
                    <article
                      key={buildFailureCardKey(test, index)}
                      className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4"
                      data-testid={`failing-test-${cardTestId}`}
                    >
                      <div className="flex min-w-0 flex-col gap-4">
                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="min-w-0 break-words text-base font-semibold text-white">{displayName}</p>
                              <Badge variant="destructive">{test.failures} failures</Badge>
                            </div>

                            <p className="break-words text-xs uppercase tracking-[0.2em] text-slate-400">
                              {test.suite || "Unknown suite"}
                            </p>
                          </div>

                          <Button
                            variant="default"
                            data-testid={`ai-analyze-${cardTestId}`}
                            className="w-full shrink-0 lg:ml-4 lg:w-[13rem] lg:max-w-full"
                            disabled={busyAction !== null}
                            onClick={() => void runAnalysis([test])}
                          >
                            Analyze this failure only
                          </Button>
                        </div>

                        <div
                          className="w-full min-w-0 max-w-none overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80"
                          data-testid={`failure-error-log-${cardTestId}`}
                        >
                          <pre className="inline-block min-w-full w-max p-3 text-xs leading-5 whitespace-pre text-slate-300">
                            {test.error_message || "No error message captured."}
                          </pre>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {showAiAnalysisSection && (
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold">AI failure analysis</h2>
                  <p className="text-sm text-slate-400">
                    Results appear only after you analyze the latest local run and are scoped to that run.
                  </p>
                </div>

                <div className="space-y-4">
                  {aiAnalysis.length === 0 && (
                    <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                      No AI analysis available yet. Run Analyze all failures to generate the primary fix for the
                      latest local run.
                    </p>
                  )}

                  {visibleAiAnalyses.map(({ primary, alternatives }) => (
                    <article
                      key={primary.id}
                      className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4"
                      data-testid={`ai-analysis-card-${primary.id}`}
                    >
                      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-lg font-semibold text-white">{primary.test_name}</p>
                          <p className="mt-1 break-words text-sm text-slate-400">
                            {primary.classification} · confidence {primary.confidence}%
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isActionableAnalysis(primary)
                              ? "bg-cyan-400/15 text-cyan-100"
                              : primary.severity === "high"
                              ? "bg-rose-400/15 text-rose-200"
                              : primary.severity === "medium"
                                ? "bg-amber-400/15 text-amber-200"
                                : "bg-emerald-400/15 text-emerald-200"
                          }`}
                        >
                          {isActionableAnalysis(primary) ? "actionable" : primary.severity}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Summary</p>
                          <p className="mt-2 break-words text-sm leading-6 text-slate-200">{primary.ai_summary}</p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Suggested Fix</p>
                          <p className="mt-2 break-words text-sm leading-6 text-slate-200">{primary.suggested_fix}</p>
                        </div>

                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Target File</p>
                            <p className="mt-2 break-words text-sm text-slate-200">
                              {primary.target_file || "Unknown"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Confidence</p>
                            <p className="mt-2 text-sm text-slate-200">{primary.confidence}%</p>
                          </div>
                        </div>

                        {alternatives.length > 0 && (
                          <details className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                              View {alternatives.length} lower-confidence alternative
                              {alternatives.length === 1 ? "" : "s"}
                            </summary>
                            <div className="mt-3 space-y-3">
                              {alternatives.map((alternative) => (
                                <div
                                  key={alternative.id}
                                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-3"
                                >
                                  <p className="text-sm font-medium text-white">{alternative.test_name}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                    {alternative.classification} · confidence {alternative.confidence}%
                                  </p>
                                  <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                                    {alternative.suggested_fix}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {primary.generated_patch && (
                          <details className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                              View generated patch
                            </summary>
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                              {primary.generated_patch}
                            </pre>
                          </details>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            data-testid={`ai-apply-${primary.id}`}
                            className="shrink-0"
                            disabled={!isActionableAnalysis(primary) || busyAction !== null}
                            onClick={() => void applyAnalysisFix(primary.id)}
                          >
                            {isActionableAnalysis(primary) ? "Apply AI fix" : "Not actionable"}
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
