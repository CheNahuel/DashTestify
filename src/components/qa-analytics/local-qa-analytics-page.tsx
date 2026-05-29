"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

type TestRun = {
  id: string | number;
  branch: string | null;
  commit_sha: string | null;
  created_at: string;
  passed: number | null;
  failed: number | null;
  total_tests: number | null;
};

type TestResult = {
  run_id: string | number;
  suite: string | null;
  test_name: string | null;
  status: string;
  error_message: string | null;
};

type LatestFailure = {
  test_name: string | null;
  failures: number;
  run_id: string | number;
  suite: string | null;
  error_message: string | null;
};

type AiAnalysis = {
  id: string;
  run_id?: string | number | null;
  test_name: string;
  error_message?: string | null;
  created_at?: string | null;
  ai_summary: string;
  suggested_fix: string;
  severity: string;
  classification: string;
  confidence: number;
  target_file: string | null;
  generated_patch: string | null;
};

type AiProvider = "openai" | "gemini";

const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

const ACTIONABLE_CONFIDENCE_THRESHOLD = 80;
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 90;

function normalizeTestId(value: string | null | undefined, fallback = "unknown-test") {
  const normalized = value?.trim() ? value.trim() : fallback;

  return normalized.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function formatAnalysisGroupKey(analysis: Pick<AiAnalysis, "test_name" | "target_file" | "error_message">) {
  const testName = normalizeTestId(analysis.test_name, "unknown-test");
  const targetFile = normalizeTestId(analysis.target_file, "unknown-file");
  const errorMessage = normalizeTestId(analysis.error_message, "unknown-error");

  return `${testName}::${targetFile}::${errorMessage}`;
}

function isActionableAnalysis(analysis: AiAnalysis) {
  return (
    analysis.classification === "test_issue" &&
    analysis.confidence >= ACTIONABLE_CONFIDENCE_THRESHOLD &&
    Boolean(analysis.generated_patch)
  );
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function collapseAiAnalyses(analyses: AiAnalysis[]) {
  const grouped = analyses.reduce<Record<string, AiAnalysis[]>>((acc, analysis) => {
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

function formatDisplayDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type LocalQaAnalyticsPageProps = {
  currentBranch: string;
};

export function LocalQaAnalyticsPage({ currentBranch }: LocalQaAnalyticsPageProps) {
  const [latestRun, setLatestRun] = useState<TestRun | null>(null);
  const [latestFailures, setLatestFailures] = useState<LatestFailure[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis[]>([]);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("gemini");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let mounted = true;

    async function loadLatestRun() {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(error);
        return;
      }

      const nextLatestRun = (data || [])[0] as TestRun | undefined;

      if (!mounted) {
        return;
      }

      setLatestRun(nextLatestRun ?? null);

      if (!nextLatestRun) {
        setLatestFailures([]);
        return;
      }

      const { data: failuresData, error: failuresError } = await supabase
        .from("test_results")
        .select("*")
        .eq("run_id", nextLatestRun.id)
        .eq("status", "failed");

      if (failuresError) {
        console.error(failuresError);
        if (mounted) {
          setLatestFailures([]);
        }
        return;
      }

      if (mounted) {
        const grouped = Object.values(
          ((failuresData || []) as TestResult[]).reduce<Record<string, LatestFailure>>((acc, test) => {
            const testName = test.test_name?.trim() || "Unknown test";

            if (!acc[testName]) {
              acc[testName] = {
                test_name: test.test_name?.trim() || null,
                failures: 0,
                run_id: test.run_id,
                suite: test.suite,
                error_message: test.error_message,
              };
            }

            acc[testName].failures += 1;
            acc[testName].run_id = test.run_id;
            acc[testName].suite = test.suite;
            acc[testName].error_message = test.error_message;

            return acc;
          }, {}),
        ).sort((left, right) => right.failures - left.failures);

        setLatestFailures(grouped);
      }
    }

    void loadLatestRun();

    return () => {
      mounted = false;
    };
  }, []);

  async function sendAiAction(payload: unknown) {
    setBusyAction("ai-action");
    setActionStatus(null);

    try {
      const response = await fetch("/api/analytics/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        analyses?: AiAnalysis[];
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

  async function loadAiAnalysis(runId: string | number) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("ai_analysis")
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAiAnalysis((data || []) as AiAnalysis[]);
  }

  async function runAnalysis(targetFailures: LatestFailure[]) {
    setAnalysisRequested(true);

    if (targetFailures.length === 0 || !latestRun) {
      setActionStatus("No local run is available yet. Run Playwright locally to populate this view.");
      setAiAnalysis([]);
      return [] as AiAnalysis[];
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
      const insertedAnalyses = (result?.analyses || []) as AiAnalysis[];

      await loadAiAnalysis(latestRun.id);

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

  async function analyzeAndAutoApplyHighConfidenceFixes(targetFailures: LatestFailure[]) {
    const insertedAnalyses = await runAnalysis(targetFailures);
    const autoApplicableAnalyses = insertedAnalyses.filter(
      (analysis) =>
        analysis.classification === "test_issue" &&
        analysis.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD &&
        Boolean(analysis.generated_patch),
    );

    if (autoApplicableAnalyses.length === 0) {
      setActionStatus((current) =>
        `${current || `Created ${insertedAnalyses.length} AI analysis result(s).`} No high-confidence test fixes were eligible for auto-apply.`,
      );
      return;
    }

    for (const analysis of autoApplicableAnalyses) {
      await sendAiAction({
        action: "apply" as const,
        analysisId: analysis.id,
      });
    }

    setActionStatus(
      `Created ${insertedAnalyses.length} AI analysis result(s) with ${providerLabels[selectedProvider]}. Auto-applied ${autoApplicableAnalyses.length} high-confidence fix(es).`,
    );
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:min-w-[320px]">
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

              <div className="flex min-w-0 flex-wrap gap-2">
                <Button
                  data-testid="ai-analyze-all"
                  className="w-full sm:w-auto"
                  disabled={!canAnalyze}
                  onClick={() => void runAnalysis(latestFailures)}
                >
                  {busyAction ? "Working..." : "Analyze all failures"}
                </Button>

                <Button
                  data-testid="ai-auto-apply-all"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!canAnalyze}
                  onClick={() => void analyzeAndAutoApplyHighConfidenceFixes(latestFailures)}
                >
                  Analyze all and auto-apply safe fixes
                </Button>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                Use the first button to analyze every failure in the latest run. Use the second button to analyze the
                same run and auto-apply only high-confidence fixes. Use a failure card button to analyze just that
                specific error.
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

        {localRunMissing ? (
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

                <Button variant="outline" disabled={!canAnalyze} onClick={() => void runAnalysis(latestFailures)}>
                  Analyze latest run again
                </Button>
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

                  return (
                    <article
                      key={`${displayName}-${test.run_id}`}
                      className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4"
                      data-testid={`failing-test-${testId}`}
                    >
                      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="min-w-0 break-words text-base font-semibold text-white">{displayName}</p>
                            <Badge variant="destructive">{test.failures} failures</Badge>
                          </div>

                          <p className="break-words text-xs uppercase tracking-[0.2em] text-slate-400">
                            {test.suite || "Unknown suite"}
                          </p>

                          <div className="max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80">
                            <pre className="min-w-max p-3 text-xs leading-5 whitespace-pre text-slate-300">
                              {test.error_message || "No error message captured."}
                            </pre>
                          </div>
                        </div>

                        <Button
                          variant="default"
                          data-testid={`ai-analyze-${testId}`}
                          className="w-full lg:ml-4 lg:w-[13rem] lg:max-w-full"
                          disabled={busyAction !== null}
                          onClick={() => void runAnalysis([test])}
                        >
                          Analyze this failure
                        </Button>
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
