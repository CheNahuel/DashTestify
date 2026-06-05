"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  AiProvider,
  LatestLocalFailure,
  LocalAiAnalysis,
  LocalTestRun,
} from "@/components/qa-analytics/types";

const providerOptions: Array<{
  value: AiProvider;
  label: string;
  description: string;
}> = [
  {
    value: "claude",
    label: "Claude",
    description: "Most token-efficient (Haiku) — recommended for local analysis",
  },
  {
    value: "gemini",
    label: "Gemini",
    description: "Fast and capable for failure analysis",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "GPT-4o Mini for comparison and detailed analysis",
  },
  {
    value: "groq",
    label: "Groq",
    description: "High-speed inference provider",
  },
  {
    value: "deepseek",
    label: "Deepseek",
    description: "Alternative provider for testing",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    description: "Multi-model API aggregator",
  },
];

const runModeOptions: Array<{
  value: QaAnalyticsRunMode;
  label: string;
  description: string;
}> = [
  {
    value: "mock",
    label: "Mock Mode",
    description: "Fast tests with mocked API data (recommended)",
  },
  {
    value: "live",
    label: "Live Mode",
    description: "Integration tests against live CoinCap API",
  },
];

const ACTIONABLE_CONFIDENCE_THRESHOLD = 80;

function normalizeTestId(value: string | null | undefined, fallback = "unknown-test") {
  const normalized = value?.trim() ? value.trim() : fallback;

  return normalized
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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

function formatAnalysisGroupKey(
  analysis: Pick<LocalAiAnalysis, "test_name" | "target_file" | "error_message">,
) {
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

function getRunStatusMessage(
  runState: QaAnalyticsRunState,
  latestRunSummary: LocalRunSummary | null,
) {
  if (runState.isStale) {
    return runState.message;
  }

  if (runState.status === "success") {
    return "Report success. Latest results refreshed.";
  }

  if (runState.status === "failed") {
    const failedCount = latestRunSummary?.failed;

    if (typeof failedCount === "number" && failedCount === 0) {
      return "Tests completed. Latest results refreshed.";
    }

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

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(durationMs: number | null | undefined) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    return "Unknown duration";
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const totalSeconds = durationMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${minutes}m ${seconds.toFixed(1)}s`;
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
        const actionableDiff =
          Number(isActionableAnalysis(right)) - Number(isActionableAnalysis(left));

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
        alternatives: ordered
          .slice(1)
          .filter(
            (a) =>
              (a.suggested_fix && String(a.suggested_fix).trim().length > 0) ||
              Boolean(a.generated_patch),
          ),
      };
    })
    .sort((left, right) => {
      const actionableDiff =
        Number(isActionableAnalysis(right.primary)) - Number(isActionableAnalysis(left.primary));

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
  duration_ms: number | null;
  report_path: string;
};

type LocalSnapshot = {
  latestRun: LocalTestRun | null;
  latestRunSummary: LocalRunSummary | null;
  latestFailures: LatestLocalFailure[];
  aiAnalysis: LocalAiAnalysis[];
  error?: string;
};

type QaInsight = {
  id: string;
  type: "tip" | "news";
  title: string;
  summary: string;
  category: string;
  link: string | null;
};

type QaAnalyticsRunMode = "mock" | "live";

type QaAnalyticsRunState = {
  jobId: string;
  mode: QaAnalyticsRunMode;
  status: "idle" | "running" | "success" | "failed";
  progress: number;
  currentStep: number | null;
  totalSteps: number | null;
  currentTestLabel: string | null;
  message: string;
  finishedAt: string | null;
  exitCode: number | null;
  isStale?: boolean;
};

export function LocalQaAnalyticsPage({ currentBranch }: LocalQaAnalyticsPageProps) {
  const mountedRef = useRef(true);
  const refreshedJobIdRef = useRef<string | null>(null);
  const abortRequestedRef = useRef(false);
  const [latestRun, setLatestRun] = useState<LocalTestRun | null>(null);
  const [latestRunSummary, setLatestRunSummary] = useState<LocalRunSummary | null>(null);
  const [latestFailures, setLatestFailures] = useState<LatestLocalFailure[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<LocalAiAnalysis[]>([]);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [selectedFailureIds, setSelectedFailureIds] = useState<Set<string>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("claude");
  const [selectedRunMode, setSelectedRunMode] = useState<QaAnalyticsRunMode>("mock");
  const [runState, setRunState] = useState<QaAnalyticsRunState | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptAnalysisId, setPromptAnalysisId] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [insights, setInsights] = useState<QaInsight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  const loadLocalSnapshot = useCallback(
    async (options?: { showLoading?: boolean; cacheBust?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      const cacheBust = options?.cacheBust ?? false;

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(
          `/api/qa-analytics/local-snapshot${cacheBust ? `?t=${Date.now()}` : ""}`,
          {
            cache: "no-store",
          },
        );
        const data = (await response.json()) as LocalSnapshot;

        if (!response.ok) {
          throw new Error(data.error || "Unable to load the local QA Analytics snapshot.");
        }

        if (!mountedRef.current) {
          return null;
        }

        setLatestRun(data.latestRun);
        setLatestRunSummary(data.latestRunSummary);
        setLatestFailures(data.latestFailures || []);
        setAiAnalysis(data.aiAnalysis || []);
        setActionStatus(null);
        setSelectedFailureIds(new Set());

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
    },
    [],
  );

  async function loadRunState() {
    try {
      const response = await fetch("/api/qa-analytics/run-tests");
      const data = (await response.json()) as { run: QaAnalyticsRunState | null };

      if (!response.ok) {
        return;
      }

      if (mountedRef.current) {
        setRunState((current) => {
          if (data.run) {
            return data.run;
          }

          if (current?.status === "running") {
            return current;
          }

          return null;
        });
      }
    } catch {
      // Ignore transient polling failures so an in-flight run stays visible.
    }
  }

  async function requestRunAbort() {
    if (abortRequestedRef.current) {
      return;
    }

    abortRequestedRef.current = true;

    try {
      await fetch("/api/qa-analytics/run-tests", {
        method: "DELETE",
        cache: "no-store",
        keepalive: true,
      });
    } catch {
      // Best effort only.
    }
  }

  const refreshLatestRunAfterCompletion = useCallback(
    async (run: QaAnalyticsRunState) => {
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
        // Only update message for non-stale runs
        if (!run.isStale) {
          const failedCount =
            latestSnapshot?.latestRunSummary?.failed ?? latestRunSummary?.failed ?? null;
          const terminalMessage =
            run.status === "success"
              ? "Report success. Latest results refreshed."
              : failedCount === 0
                ? "Tests completed. Latest results refreshed."
                : failedCount === null
                  ? "Report failed. Latest results refreshed."
                  : `Report failed (${failedCount} failures). Latest results refreshed.`;

          setRunState((current) =>
            current?.jobId === run.jobId ? { ...current, message: terminalMessage } : current,
          );
        }
      }
    },
    [latestRunSummary, loadLocalSnapshot],
  );

  useEffect(() => {
    mountedRef.current = true;

    async function loadInsights() {
      try {
        const response = await fetch("/api/qa-insights");
        if (response.ok) {
          const data = (await response.json()) as { insights?: QaInsight[] };
          if (data.insights && mountedRef.current) {
            setInsights(data.insights.slice(0, 10));
          }
        }
      } catch {
        // Insights failed to load; that's ok, just show empty state
      }
    }

    void loadLocalSnapshot({ showLoading: true });
    void loadRunState();
    void loadInsights();

    return () => {
      mountedRef.current = false;
    };
  }, [loadLocalSnapshot]);

  useEffect(() => {
    if (runState?.status !== "running") {
      return undefined;
    }

    const handleLifecycleEvent = () => {
      void requestRunAbort();
    };

    window.addEventListener("beforeunload", handleLifecycleEvent);
    window.addEventListener("pagehide", handleLifecycleEvent);

    const timer = window.setInterval(() => {
      void loadRunState();
    }, 1500);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", handleLifecycleEvent);
      window.removeEventListener("pagehide", handleLifecycleEvent);
    };
  }, [runState?.status]);

  useEffect(() => {
    if (runState?.status !== "success" && runState?.status !== "failed") {
      return;
    }

    if (runState.isStale) {
      return;
    }

    void refreshLatestRunAfterCompletion(runState);
  }, [refreshLatestRunAfterCompletion, runState]);

  useEffect(() => {
    if (insights.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [insights.length]);

  useEffect(() => {
    if (!latestRun) {
      return;
    }

    setCurrentInsightIndex(Math.floor(Math.random() * Math.max(1, insights.length)));
  }, [latestRun?.id, insights.length]);

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
    abortRequestedRef.current = false;

    // Clear previous results for fresh run
    setLatestRun(null);
    setLatestRunSummary(null);
    setLatestFailures([]);
    setAiAnalysis([]);
    setAnalysisRequested(false);
    setSelectedFailureIds(new Set());
    setActionStatus(null);

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
      setActionStatus(
        "No local run is available yet. Run Playwright locally to populate this view.",
      );
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

      // Analysis completed, results will be displayed automatically
      return insertedAnalyses;
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "AI analysis failed.");
      return [];
    }
  }

  async function applyAnalysisFix(analysisId: string) {
    try {
      await sendAiAction({
        action: "apply" as const,
        analysisId,
      });

      // Remove the applied analysis from the list (visual feedback that fix was applied)
      setAiAnalysis((current) => {
        const appliedAnalysis = current.find((a) => a.id === analysisId);
        const filtered = current.filter((analysis) => analysis.id !== analysisId);

        // Also remove the corresponding failure from latestFailures
        if (appliedAnalysis) {
          setLatestFailures((failures) =>
            failures.filter(
              (failure) =>
                !(
                  failure.test_name === appliedAnalysis.test_name &&
                  failure.error_message === appliedAnalysis.error_message
                ),
            ),
          );
        }

        return filtered;
      });

      setActionStatus("Fix was successfully applied.");
      setSelectedFailureIds(new Set());
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Applying the AI fix failed.");
    }
  }

  function openPromptDialog(analysisId: string) {
    setPromptAnalysisId(analysisId);
    setPromptInput("");
    setPromptDialogOpen(true);
  }

  async function submitPrompt() {
    if (!promptAnalysisId || !promptInput.trim()) {
      return;
    }

    const analysis = aiAnalysis.find((a) => a.id === promptAnalysisId);
    if (!analysis) {
      return;
    }

    setBusyAction("ai-action");
    setActionStatus(null);

    try {
      const result = (await sendAiAction({
        action: "refactor" as const,
        analysisId: analysis.id,
        baseFix: analysis.suggested_fix,
        alternativeFix: analysis.suggested_fix,
        userSuggestion: promptInput,
        provider: selectedProvider,
      })) as { analysis?: LocalAiAnalysis } | null;

      const revisedAnalysis = result?.analysis;

      if (revisedAnalysis) {
        setAiAnalysis((current) => [revisedAnalysis, ...current]);
        setActionStatus("New patch created from AI revision.");
      }

      setPromptDialogOpen(false);
      setPromptInput("");
      setPromptAnalysisId(null);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Prompting AI failed.");
    } finally {
      setBusyAction(null);
    }
  }

  const localRunMissing = latestRun === null;
  const isRunInProgress = runState?.status === "running";
  const canAnalyze = latestRun !== null && selectedFailureIds.size > 0 && busyAction === null;
  const currentBranchLabel = currentBranch || latestRun?.branch || "unknown branch";
  const isAnalysisAvailable = latestFailures.length > 0 && !isRunInProgress;
  const aiPanelMuted = !isAnalysisAvailable;
  const showAiAnalysisSection = analysisRequested;
  const visibleAiAnalyses = collapseAiAnalyses(aiAnalysis);
  const actionableAiAnalyses = visibleAiAnalyses
    .map(({ primary }) => primary)
    .filter(isActionableAnalysis);
  const canApplyAll =
    latestRun !== null &&
    actionableAiAnalyses.length > 0 &&
    busyAction === null &&
    !isRunInProgress;
  const latestRunPassRate =
    latestRunSummary && latestRunSummary.total_tests > 0
      ? Math.round((latestRunSummary.passed / latestRunSummary.total_tests) * 1000) / 10
      : null;
  const latestRunCommit = latestRun?.commit_sha ? latestRun.commit_sha.slice(0, 8) : "unknown";
  const latestRunDuration = formatDuration(latestRunSummary?.duration_ms ?? null);
  const latestRunDate = formatShortDate(latestRun?.created_at);
  const heroMetadata = latestRun
    ? [
        { label: "Branch", value: latestRun.branch || currentBranchLabel },
        { label: "Commit", value: latestRunCommit },
        { label: "Date", value: latestRunDate },
        { label: "Duration", value: latestRunDuration },
      ]
    : [];
  const summaryMetrics = latestRunSummary
    ? [
        { label: "Total", value: String(latestRunSummary.total_tests), tone: "emerald" as const },
        { label: "Passed", value: String(latestRunSummary.passed), tone: "emerald" as const },
        { label: "Failed", value: String(latestRunSummary.failed), tone: "rose" as const },
        {
          label: "Pass rate",
          value: latestRunPassRate === null ? "n/a" : `${latestRunPassRate}%`,
          tone: "sky" as const,
        },
        { label: "Skipped", value: String(latestRunSummary.skipped), tone: "amber" as const },
        { label: "Flaky", value: String(latestRunSummary.flaky), tone: "sky" as const },
      ]
    : [];
  const panelShellClass =
    "rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10 backdrop-blur";

  async function applyAllAnalysisFixes() {
    if (latestRun === null) {
      setActionStatus(
        "No local run is available yet. Run Playwright locally to populate this view.",
      );
      return;
    }

    if (actionableAiAnalyses.length === 0) {
      setActionStatus("No actionable fixes are available yet. Analyze one or more failures first.");
      return;
    }

    setBusyAction("ai-action");
    setActionStatus(null);

    try {
      const appliedFiles = new Set<string>();
      const appliedIds = new Set<string>();
      const appliedAnalyses: LocalAiAnalysis[] = [];

      for (const analysis of actionableAiAnalyses) {
        const result = (await sendAiAction({
          action: "apply" as const,
          analysisId: analysis.id,
        })) as {
          applyMode?: "local" | "branch";
          branchName?: string;
          filePath?: string;
        } | null;

        if (result?.filePath) {
          appliedFiles.add(result.filePath);
        }
        appliedIds.add(analysis.id);
        appliedAnalyses.push(analysis);
      }

      // Remove the applied analyses from the list (visual feedback that fixes were applied)
      setAiAnalysis((current) => current.filter((analysis) => !appliedIds.has(analysis.id)));

      // Also remove the corresponding failures from latestFailures
      setLatestFailures((failures) =>
        failures.filter(
          (failure) =>
            !appliedAnalyses.some(
              (analysis) =>
                failure.test_name === analysis.test_name &&
                failure.error_message === analysis.error_message,
            ),
        ),
      );

      setActionStatus(
        `${appliedAnalyses.length} fix${appliedAnalyses.length === 1 ? "" : "es"} successfully applied.`,
      );
      setSelectedFailureIds(new Set());
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Applying the AI fixes failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {isLoading ? (
          <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10">
            <h2 className="text-2xl font-semibold text-slate-100">Loading latest local run</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Reading the latest Playwright results from test-results/results.json.
            </p>
          </section>
        ) : (
          <>
            <header className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className={panelShellClass}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">
                      QA Analytics Local
                    </p>
                    {localRunMissing ? (
                      <>
                        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                          No local runs yet
                        </h1>
                        <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                          Run Playwright locally to generate a test execution for analysis.
                        </p>
                      </>
                    ) : (
                      <>
                        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                          Latest local run
                        </h1>
                        <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                          This view is focused on the newest local Playwright run only. It does not
                          use historical runs for the main dashboard.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {!localRunMissing && latestRun && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {heroMetadata.map((item) => (
                      <div
                        key={item.label}
                        data-testid={`hero-metadata-${normalizeTestId(item.label, "meta")}`}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-2 break-words text-sm font-medium text-slate-100">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {!localRunMissing && latestRunSummary && (
                  <p className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                    {latestRunSummary.failed > 0
                      ? "Tests failed. Use the AI analysis tools below to diagnose failures and generate fixes."
                      : "All tests passed. Run the test suite again to generate new results for analysis."}
                  </p>
                )}

                {!localRunMissing && latestRunSummary?.report_path && (
                  <div className="mt-4 flex justify-end">
                    <a
                      href={latestRunSummary.report_path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15"
                    >
                      Open Playwright report
                    </a>
                  </div>
                )}

                {localRunMissing && insights.length > 0 && (
                  <div className="mt-6">
                    <div
                      key={insights[currentInsightIndex]?.id}
                      className="relative min-h-[220px] overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 to-blue-500/5 p-6 shadow-lg transition-opacity duration-500"
                      data-testid={`qa-insight-card-${insights[currentInsightIndex]?.id}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="mb-2 inline-block rounded-full bg-cyan-400/20 px-3 py-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
                                {insights[currentInsightIndex]?.category}
                              </p>
                            </div>
                            {insights[currentInsightIndex]?.type === "news" && (
                              <div className="ml-2 inline-block">
                                <span className="inline-flex items-center rounded-full bg-amber-400/20 px-2 py-1 text-xs font-semibold text-amber-200">
                                  📰 News
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold leading-tight text-white sm:text-2xl">
                            {insights[currentInsightIndex]?.title}
                          </h3>
                          <p className="mt-4 text-sm leading-6 text-slate-300">
                            {insights[currentInsightIndex]?.summary}
                          </p>
                        </div>

                        {insights[currentInsightIndex]?.link && (
                          <div className="pt-2">
                            <a
                              href={insights[currentInsightIndex]?.link || ""}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
                            >
                              Read more →
                            </a>
                          </div>
                        )}

                        <div className="flex gap-1 pt-2">
                          {insights.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentInsightIndex(index)}
                              className={`h-1 rounded-full transition-all ${
                                index === currentInsightIndex
                                  ? "w-6 bg-cyan-400"
                                  : "w-1.5 bg-slate-600 hover:bg-slate-500"
                              }`}
                              data-testid={`insight-nav-${index}`}
                              type="button"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section
                className={`${panelShellClass} flex min-w-0 flex-col gap-4`}
                data-testid="run-controls-panel"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/90">
                      Run Controls
                    </p>
                    <p className="text-sm text-slate-300">
                      Pick the mode and launch Playwright locally.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {runModeOptions.map((option) => {
                      const isSelected = selectedRunMode === option.value;
                      const isDisabled = runState?.status === "running";

                      return (
                        <button
                          key={option.value}
                          type="button"
                          data-testid={`run-mode-${option.value}`}
                          aria-pressed={isSelected}
                          disabled={isDisabled}
                          className={[
                            "flex min-w-0 flex-col rounded-2xl border px-4 py-3 text-left transition-all",
                            isDisabled
                              ? "border-slate-600/30 bg-slate-950/30 opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "border-emerald-300/40 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                                : "border-white/10 bg-slate-950/50 hover:border-white/20 hover:bg-slate-900/80",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => !isDisabled && setSelectedRunMode(option.value)}
                        >
                          <span
                            className={`text-sm font-semibold ${
                              isDisabled ? "text-slate-500" : isSelected ? "text-emerald-100" : "text-slate-100"
                            }`}
                          >
                            {option.label}
                          </span>
                          <span
                            className={`mt-1 text-xs leading-5 ${
                              isDisabled
                                ? "text-slate-600"
                                : isSelected
                                  ? "text-emerald-100/75"
                                  : "text-slate-400"
                            }`}
                          >
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    data-testid="run-tests-button"
                    className="min-h-[56px] w-full"
                    disabled={isStartingRun || runState?.status === "running"}
                    onClick={() => void startTestRun(selectedRunMode)}
                  >
                    {isStartingRun || runState?.status === "running"
                      ? `Running ${selectedRunMode} tests...`
                      : "Run tests"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      Execution status
                    </p>
                    {runState?.status &&
                      runState.status !== "idle" &&
                      runState.status !== "running" && (
                        <Badge
                          variant="outline"
                          data-testid="run-status-badge"
                          className={
                            runState.status === "success"
                              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                              : "border-rose-300/30 bg-rose-400/10 text-rose-100"
                          }
                        >
                          {runState.status}
                        </Badge>
                      )}
                  </div>

                  {runState?.status === "running" && (
                    <div className="mt-3 space-y-2">
                      <Progress value={runState.progress || 8} />
                      <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          {runState.mode === "live" ? "E2E live mode" : "E2E mock mode"}
                        </p>
                        <p className="text-sm font-medium text-slate-100">
                          {runState.currentTestLabel
                            ? `Now running: ${runState.currentTestLabel}`
                            : "Running the next test..."}
                        </p>
                        <p className="text-xs text-slate-400">
                          {runState.currentStep && runState.totalSteps
                            ? `Progress ${runState.currentStep}/${runState.totalSteps}`
                            : "Waiting for test progress..."}
                        </p>
                      </div>
                    </div>
                  )}

                  {runState?.status &&
                    runState.status !== "idle" &&
                    runState.status !== "running" && (
                      <p
                        className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                          runState.status === "success"
                            ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                            : runState.status === "failed" &&
                                !runState.isStale &&
                                (latestRunSummary?.failed ?? 0) === 0
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
              </section>
            </header>

            {!localRunMissing && latestRunSummary && (
              <section className={panelShellClass}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  {summaryMetrics.map((item) => (
                    <div
                      key={item.label}
                      data-testid={`summary-metric-${normalizeTestId(item.label, "metric")}`}
                      className={[
                        "rounded-2xl border px-4 py-3",
                        item.tone === "rose"
                          ? "border-rose-300/20 bg-rose-400/10"
                          : item.tone === "amber"
                            ? "border-amber-300/20 bg-amber-400/10"
                            : item.tone === "sky"
                              ? "border-sky-300/20 bg-sky-400/10"
                              : "border-emerald-300/20 bg-emerald-400/10",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!localRunMissing && (latestRunSummary || isRunInProgress) ? (
              (latestRunSummary && latestRunSummary.failed > 0) || isRunInProgress ? (
                <section
                  className={`grid gap-6 xl:grid-cols-2 ${isRunInProgress ? "opacity-60 grayscale" : ""}`}
                >
                  <div className={panelShellClass}>
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/90">
                          Latest run failures
                        </p>
                        <p className="text-sm text-slate-300">
                          These are the failures from the latest local run only.
                        </p>
                      </div>
                      {latestFailures.length > 0 && (
                        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-300 hover:text-slate-100">
                          <input
                            type="checkbox"
                            data-testid="select-all-failures"
                            checked={
                              latestFailures.length > 0 &&
                              latestFailures.every((test, index) => {
                                const testId = normalizeTestId(
                                  test.test_name,
                                  `unknown-test-${index + 1}`,
                                );
                                return selectedFailureIds.has(testId);
                              })
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allIds = new Set(
                                  latestFailures.map((test, index) =>
                                    normalizeTestId(test.test_name, `unknown-test-${index + 1}`),
                                  ),
                                );
                                setSelectedFailureIds(allIds);
                              } else {
                                setSelectedFailureIds(new Set());
                              }
                            }}
                            className="h-4 w-4 cursor-pointer rounded border-slate-400 text-cyan-500"
                          />
                          Select all
                        </label>
                      )}
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
                        const cardTestId =
                          displayName === "Unknown test" ? `unknown-test-${index + 1}` : testId;

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
                                    <input
                                      type="checkbox"
                                      data-testid={`failure-checkbox-${cardTestId}`}
                                      checked={selectedFailureIds.has(cardTestId)}
                                      disabled={busyAction !== null}
                                      onChange={(e) => {
                                        const next = new Set(selectedFailureIds);
                                        if (e.target.checked) {
                                          next.add(cardTestId);
                                        } else {
                                          next.delete(cardTestId);
                                        }
                                        setSelectedFailureIds(next);
                                      }}
                                      className="h-5 w-5 cursor-pointer rounded border-slate-400 text-cyan-500"
                                    />
                                    <p className="min-w-0 break-words text-base font-semibold text-white">
                                      {displayName}
                                    </p>
                                    <Badge variant="destructive">{test.failures} failures</Badge>
                                  </div>

                                  <p className="break-words text-xs uppercase tracking-[0.2em] text-slate-400">
                                    {test.suite || "Unknown suite"}
                                  </p>
                                </div>
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

                  <section
                    className={[
                      panelShellClass,
                      "flex min-w-0 flex-col gap-4 transition-all",
                      aiPanelMuted ? "opacity-60 grayscale" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-testid="ai-provider-panel"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/90">
                          AI Failure Analysis
                        </p>
                        <p className="text-sm text-slate-300">
                          Select a provider to analyze the latest local failures and generate fixes.
                        </p>
                      </div>

                      <Badge variant="secondary" className="border border-white/10 bg-white/5">
                        {isRunInProgress
                          ? "Waiting for run"
                          : latestFailures.length === 0
                            ? "No failures"
                            : "Ready"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="ai-provider-select"
                        className="block text-sm font-semibold text-slate-100"
                      >
                        Provider
                      </label>
                      <div className="relative">
                        <select
                          id="ai-provider-select"
                          data-testid="ai-provider-select"
                          value={selectedProvider}
                          onChange={(event) =>
                            setSelectedProvider(event.target.value as AiProvider)
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 pr-10 text-white outline-none transition hover:border-white/20 hover:bg-slate-900/90 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-500/20"
                        >
                          {providerOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs leading-5 text-slate-400">
                        {
                          providerOptions.find((option) => option.value === selectedProvider)
                            ?.description
                        }
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
                        <Button
                          data-testid="ai-analyze-all"
                          className="w-full sm:w-auto"
                          disabled={!canAnalyze}
                          onClick={() => {
                            const selectedTests = latestFailures.filter((f, i) => {
                              const testId = normalizeTestId(f.test_name, `unknown-test-${i + 1}`);
                              return selectedFailureIds.has(testId);
                            });
                            void runAnalysis(selectedTests);
                          }}
                        >
                          {busyAction
                            ? "Working..."
                            : `Analyze selected failures${selectedFailureIds.size > 0 ? ` (${selectedFailureIds.size})` : ""}`}
                        </Button>
                       {/*  Disable for now. Applying fixes in bulk without individual review is risky.
                       <Button
                          variant="secondary"
                          data-testid="ai-apply-all"
                          className={`w-full sm:w-auto ${busyAction ? "invisible" : ""}`}
                          disabled={!canApplyAll}
                          onClick={() => void applyAllAnalysisFixes()}
                        >
                          {busyAction ? "Apply fix to all" : "Apply fix to all"}
                        </Button> 
                        */}

                        <p className="text-xs leading-5 text-slate-400">
                          {isRunInProgress
                            ? "Waiting for the current run to finish before analysis is available."
                            : latestFailures.length === 0
                              ? "No test failures to analyze in the latest local run."
                              : "Analyze failures to get AI-generated summaries and patches. Apply actionable fixes directly to your code."}
                        </p>
                      </div>
                    </div>

                    {showAiAnalysisSection && (
                      <div className="space-y-4">
                        {aiAnalysis.length === 0 && (
                          <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                            No AI analysis available yet. Run Analyze all failures to generate the
                            primary fix for the latest local run.
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
                                <p className="break-words text-lg font-semibold text-white">
                                  {primary.test_name}
                                </p>
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
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  AI Summary
                                </p>
                                <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                                  {primary.ai_summary}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  Suggested Fix
                                </p>
                                <p className="mt-2 break-words text-sm leading-6 text-slate-200">
                                  {primary.suggested_fix}
                                </p>
                              </div>

                              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                    Target File
                                  </p>
                                  <p className="mt-2 break-words text-sm text-slate-200">
                                    {primary.target_file || "Unknown"}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                    Confidence
                                  </p>
                                  <p className="mt-2 text-sm text-slate-200">
                                    {primary.confidence}%
                                  </p>
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
                                        <p className="text-sm font-medium text-white">
                                          {alternative.test_name}
                                        </p>
                                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                          {alternative.classification} · confidence{" "}
                                          {alternative.confidence}%
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
                                  className="
                                    bg-emerald-500/15
                                    border border-emerald-500/30
                                    text-emerald-200
                                    hover:bg-emerald-500/25
                                      "
                                  disabled={!isActionableAnalysis(primary) || busyAction !== null}
                                  onClick={() => void applyAnalysisFix(primary.id)}
                                >
                                  {isActionableAnalysis(primary)
                                    ? "Apply AI fix"
                                    : "Not actionable"}
                                </Button>
                                <Button
                                  data-testid={`ai-prompt-${primary.id}`}
                                  disabled={busyAction !== null}
                                  onClick={() => openPromptDialog(primary.id)}
                                  className="
                                    shrink-0
                                    border-0
                                    bg-gradient-to-r
                                    from-fuchsia-500
                                    via-violet-500
                                    to-cyan-500
                                    text-white
                                    font-semibold
                                    shadow-lg
                                    shadow-violet-500/30
                                    hover:scale-105
                                    hover:shadow-xl
                                    hover:shadow-violet-500/50
                                    transition-all
                                  "
                                >
                                  {busyAction ? "🧠 Thinking..." : "💬 Ask AI"}
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    {actionStatus && (
                      <p
                        className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100"
                        data-testid="ai-status-message"
                      >
                        {actionStatus}
                      </p>
                    )}
                  </section>
                </section>
              ) : (
                <section
                  className={`${panelShellClass} border-emerald-300/20 bg-emerald-400/10 shadow-2xl shadow-emerald-950/10`}
                >
                  <h2 className="text-2xl font-semibold text-emerald-100">All tests passed</h2>
                  <p className="mt-3 max-w-2xl text-sm text-emerald-50/80">
                    No failures to analyze. Run the test suite again to get results that the AI can
                    help diagnose and fix.
                  </p>
                </section>
              )
            ) : null}
          </>
        )}
      </div>

      {promptDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPromptDialogOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-white">Rebuild patch with AI</h2>
              <p className="mt-2 text-sm text-slate-400">
                Describe how you'd like to modify the fix. For example: "Add this assertion", "Use a
                different approach", or "Include error handling".
              </p>
            </div>

            <textarea
              data-testid="ai-prompt-input"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="e.g., keep this fix but add an assertion for empty state, or instead of updating that way do this..."
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-500/20"
              rows={6}
            />

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busyAction !== null}
                onClick={() => setPromptDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!promptInput.trim() || busyAction !== null}
                onClick={() => void submitPrompt()}
              >
                {busyAction ? "Processing..." : "Rebuild patch"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
