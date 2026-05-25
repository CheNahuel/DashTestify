"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  created_at?: string | null;
};

type FailingTest = {
  test_name: string | null;
  failures: number;
  run_id: string | number;
  suite: string | null;
  error_message: string | null;
};

type FlakyTestGroup = {
  test_name: string;
  statuses: Set<string>;
};

type FlakyTest = {
  test_name: string;
};

type AiAnalysis = {
  id: string;
  test_name: string;
  ai_summary: string;
  suggested_fix: string;
  severity: string;
  classification: string;
  confidence: number;
  target_file: string | null;
  generated_patch: string | null;
  created_at?: string | null;
};

type AiProvider = "openai" | "gemini";

const providerLabels: Record<AiProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

const AUTO_APPLY_CONFIDENCE_THRESHOLD = 90;

function normalizeTestId(value: string | null | undefined, fallback = "unknown-test") {
  const normalized = value?.trim() ? value.trim() : fallback;

  return normalized.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [failingTests, setFailingTests] = useState<FailingTest[]>([]);
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("openai");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [refreshTick] = useState(0);

  useEffect(() => {
    async function loadRuns() {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setRuns((data || []) as TestRun[]);
    }

    async function loadFailingTests() {
      const { data, error } = await supabase
        .from("test_results")
        .select("*")
        .eq("status", "failed");

      if (error) {
        console.error(error);
        return;
      }

      const testResults = (data || []) as TestResult[];

      const grouped = Object.values(
        testResults.reduce<Record<string, FailingTest>>((acc, test) => {
          const testName = test.test_name?.trim() || "Unknown test";
          const groupKey = testName;

          if (!acc[groupKey]) {
            acc[groupKey] = {
              test_name: test.test_name?.trim() || null,
              failures: 0,
              run_id: test.run_id,
              suite: test.suite,
              error_message: test.error_message,
            };
          }

          acc[groupKey].failures += 1;
          acc[groupKey].run_id = test.run_id;
          acc[groupKey].suite = test.suite;
          acc[groupKey].error_message = test.error_message;

          return acc;
        }, {}),
      );

      grouped.sort((a, b) => b.failures - a.failures);

      setFailingTests(grouped.slice(0, 8));
    }

    async function loadFlakyTests() {
      const { data, error } = await supabase.from("test_results").select("*");

      if (error) {
        console.error(error);
        return;
      }

      const testResults = (data || []) as TestResult[];
      const grouped: Record<string, FlakyTestGroup> = {};

      for (const test of testResults) {
        const testName = test.test_name?.trim() || "Unknown test";

        if (!grouped[testName]) {
          grouped[testName] = {
            test_name: testName,
            statuses: new Set(),
          };
        }

        grouped[testName].statuses.add(test.status);
      }

      const flaky = Object.values(grouped)
        .filter((test) => test.statuses.has("passed") && test.statuses.has("failed"))
        .map((test) => ({
          test_name: test.test_name,
        }));

      setFlakyTests(flaky);
    }

    async function loadAiAnalysis() {
      const { data, error } = await supabase
        .from("ai_analysis")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setAiAnalysis((data || []) as AiAnalysis[]);
    }

    void loadRuns();
    void loadFailingTests();
    void loadFlakyTests();
    void loadAiAnalysis();
  }, [refreshTick]);

  const totalRuns = runs.length;
  const totalPassed = runs.reduce((acc, run) => acc + (run.passed || 0), 0);
  const totalFailed = runs.reduce((acc, run) => acc + (run.failed || 0), 0);
  const totalTests = runs.reduce((acc, run) => acc + (run.total_tests || 0), 0);
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";

  const chartData = useMemo(
    () =>
      [...runs].reverse().map((run) => ({
        date: new Date(run.created_at).toLocaleDateString(),
        passed: run.passed,
        failed: run.failed,
      })),
    [runs],
  );

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

  async function analyzeFailures(targetFailures: FailingTest[]) {
    return runAnalysis(targetFailures);
  }

  async function runAnalysis(targetFailures: FailingTest[]) {
    if (targetFailures.length === 0) {
      setActionStatus("No failing tests were available to analyze.");
      return [] as AiAnalysis[];
    }

    const payload = {
      action: "analyze" as const,
      provider: selectedProvider,
      failures: targetFailures.map((failure) => ({
        runId: failure.run_id,
        testName: failure.test_name,
        suite: failure.suite,
        errorMessage: failure.error_message || "",
      })),
    };

    try {
      const result = await sendAiAction(payload);
      const insertedAnalyses = (result?.analyses || []) as AiAnalysis[];

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
      return [] as AiAnalysis[];
    }
  }

  async function applyAnalysisFix(analysisId: string) {
    try {
      const result = await sendAiAction({
        action: "apply" as const,
        analysisId,
      });

      setActionStatus(
        `Applied AI fix on ${result?.branchName || "ai-fix branch"} for ${result?.filePath || "the selected file"}.`,
      );
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Applying the AI fix failed.");
    }
  }

  async function analyzeAndAutoApplyHighConfidenceFixes(targetFailures: FailingTest[]) {
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
      currentStatusSummary(insertedAnalyses.length, autoApplicableAnalyses.length),
    );
  }

  function currentStatusSummary(analysesCount: number, appliedCount: number) {
    return `Created ${analysesCount} AI analysis result${analysesCount === 1 ? "" : "s"} with ${providerLabels[selectedProvider]}. Auto-applied ${appliedCount} high-confidence fix${appliedCount === 1 ? "" : "es"}.`;
  }

  const canAnalyze = failingTests.length > 0 && busyAction === null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">QA Analytics</p>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Test health, failures, and AI fixes</h1>
                <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                  Review recent runs, inspect failures, and use OpenAI or Gemini to generate and
                  apply targeted fixes when something breaks.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:min-w-[320px]">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400" htmlFor="ai-provider">
                AI Provider
              </label>

              <select
                id="ai-provider"
                data-testid="ai-provider-select"
                className="w-full min-w-0 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value as AiProvider)}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>

              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="ai-analyze-all"
                  className="w-full rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  disabled={!canAnalyze}
                  onClick={() => void analyzeFailures(failingTests)}
                >
                  {busyAction ? "Working..." : "Analyze all failures"}
                </button>

                <button
                  type="button"
                  data-testid="ai-auto-apply-all"
                  className="w-full rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  disabled={!canAnalyze}
                  onClick={() => void analyzeAndAutoApplyHighConfidenceFixes(failingTests)}
                >
                  Analyze & auto-apply
                </button>
              </div>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div
            className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg"
            data-testid="stats-total-runs"
          >
            <p className="text-sm text-slate-400">Total Runs</p>
            <p className="mt-3 text-4xl font-semibold">{totalRuns}</p>
          </div>

          <div
            className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg"
            data-testid="stats-pass-rate"
          >
            <p className="text-sm text-slate-400">Pass Rate</p>
            <p className="mt-3 text-4xl font-semibold">{passRate}%</p>
          </div>

          <div
            className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg"
            data-testid="stats-passed-tests"
          >
            <p className="text-sm text-slate-400">Passed Tests</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-300">{totalPassed}</p>
          </div>

          <div
            className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg"
            data-testid="stats-failed-tests"
          >
            <p className="text-sm text-slate-400">Failed Tests</p>
            <p className="mt-3 text-4xl font-semibold text-rose-300">{totalFailed}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Test trends</h2>
              <p className="text-sm text-slate-400">Passed vs failed runs over time.</p>
            </div>
          </div>

          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={3} />
                <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-rose-950/10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Failing tests</h2>
                <p className="text-sm text-slate-400">Pick a provider and generate fixes from the latest failures.</p>
              </div>

              <button
                type="button"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-cyan-300/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAnalyze}
                onClick={() => void analyzeFailures(failingTests)}
              >
                Analyze all
              </button>
            </div>

            <div className="space-y-4">
              {failingTests.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                  No failing tests right now.
                </p>
              )}

              {failingTests.map((test, index) => {
                const displayName = test.test_name?.trim() || "Unknown test";
                const testId = normalizeTestId(test.test_name, `unknown-test-${index + 1}`);

                return (
                  <article
                    key={`${displayName}-${test.run_id}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-0"
                    data-testid={`failing-test-${testId}`}
                  >
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 break-words text-base font-semibold text-white">{displayName}</p>
                          <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200">
                            {test.failures} failures
                          </span>
                        </div>

                        <p className="break-words text-xs uppercase tracking-[0.2em] text-slate-400">
                          {test.suite || "Unknown suite"}
                        </p>

                        <pre className="w-full max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950/80 p-3 text-xs leading-5 text-slate-300">
                          {test.error_message || "No error message captured."}
                        </pre>
                      </div>

                      <button
                        type="button"
                        data-testid={`ai-analyze-${testId}`}
                        className="w-full self-start rounded-full bg-cyan-400 px-4 py-2 text-center text-sm font-semibold leading-tight text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 lg:ml-4 lg:w-[13rem] lg:max-w-full"
                        disabled={busyAction !== null}
                        onClick={() => void analyzeFailures([test])}
                      >
                        Analyze with {providerLabels[selectedProvider]}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/10">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">AI failure analysis</h2>
              <p className="text-sm text-slate-400">Results appear here after analysis and can be turned into a branch fix.</p>
            </div>

            <div className="space-y-4">
              {aiAnalysis.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                  No AI analysis available yet.
                </p>
              )}

              {aiAnalysis.map((analysis) => (
                <article
                  key={analysis.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-0"
                  data-testid={`ai-analysis-card-${analysis.id}`}
                >
                  <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-semibold text-white">{analysis.test_name}</p>
                      <p className="mt-1 break-words text-sm text-slate-400">
                        {analysis.classification} · confidence {analysis.confidence}%
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        analysis.severity === "high"
                          ? "bg-rose-400/15 text-rose-200"
                          : analysis.severity === "medium"
                            ? "bg-amber-400/15 text-amber-200"
                            : "bg-emerald-400/15 text-emerald-200"
                      }`}
                    >
                      {analysis.severity}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Summary</p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-200">{analysis.ai_summary}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Suggested Fix</p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-200">{analysis.suggested_fix}</p>
                    </div>

                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Target File</p>
                        <p className="mt-2 break-words text-sm text-slate-200">
                          {analysis.target_file || "Unknown"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Confidence</p>
                        <p className="mt-2 text-sm text-slate-200">{analysis.confidence}%</p>
                      </div>
                    </div>

                    {analysis.generated_patch && (
                      <details className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                        <summary className="cursor-pointer text-sm font-medium text-cyan-200">
                          View generated patch
                        </summary>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                          {analysis.generated_patch}
                        </pre>
                      </details>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid={`ai-apply-${analysis.id}`}
                        className="shrink-0 rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!analysis.generated_patch || busyAction !== null}
                        onClick={() => void applyAnalysisFix(analysis.id)}
                      >
                        Apply AI fix
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-yellow-950/10">
          <h2 className="mb-6 text-2xl font-semibold">Flaky tests</h2>

          <div className="space-y-4">
            {flakyTests.length === 0 && <p className="text-sm text-slate-300">No flaky tests detected.</p>}

            {flakyTests.map((test) => (
              <div key={test.test_name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-sm text-slate-100">{test.test_name}</p>
                <p className="text-sm font-semibold text-yellow-300">Flaky</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Runs</h2>
          </div>

          <div className="space-y-4">
            {runs.map((run) => (
              <article key={run.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-lg">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">Branch: {run.branch || "unknown"}</p>
                    <p className="text-sm text-slate-400">{new Date(run.created_at).toLocaleString()}</p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-sm text-slate-400">Commit</p>
                    <p className="font-mono text-sm text-slate-200">{run.commit_sha ? run.commit_sha.slice(0, 7) : "-"}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Passed</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">{run.passed}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Failed</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-300">{run.failed}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{run.total_tests}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
