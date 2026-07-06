"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TooltipProps } from "recharts";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BranchHealthWidget } from "@/components/quality-analytics/branch-health-widget";
import { FlakyTestsWidget } from "@/components/quality-analytics/flaky-tests-widget";
import { TopFailuresWidget } from "@/components/quality-analytics/top-failures-widget";
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

type TrendPoint = {
  date: string;
  passed: number;
  failed: number;
  pass_rate: number;
};

type TestTrendsResponse = {
  data?: TrendPoint[];
  error?: string;
};


const trendTooltipFormatter: NonNullable<TooltipProps["formatter"]> = (value, name) => {
  if (name === "pass_rate" && typeof value === "number") {
    return [`${value}%`, "Pass rate"];
  }

  if (typeof value === "number") {
    return [value, name === "passed" ? "Passed" : "Failed"];
  }

  if (typeof value === "string") {
    return [value, name ?? ""];
  }

  if (Array.isArray(value)) {
    return [value.join(" - "), name ?? ""];
  }

  return ["", name ?? ""];
};

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function MetricsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    const supabase = getSupabaseClient();

    async function loadRuns() {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load test runs:", error instanceof Error ? error.message : String(error));
        return;
      }

      setRuns((data || []) as TestRun[]);
    }

    async function loadTrends() {
      try {
        const response = await fetch("/api/quality-analytics/test-trends?days=30");
        const payload = (await response.json()) as TestTrendsResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load test trends.");
        }

        setTrendData(payload.data || []);
      } catch (error) {
        console.error("Failed to load test trends:", error instanceof Error ? error.message : "Unknown error");
        setTrendData([]);
      }
    }

    await loadRuns();
    await loadTrends();
  };

  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      if (mounted) {
        await loadData();
      }
    };

    void initializeData();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalRuns = runs.length;
  const totalPassed = runs.reduce((acc, run) => acc + (run.passed || 0), 0);
  const totalFailed = runs.reduce((acc, run) => acc + (run.failed || 0), 0);
  const totalTests = runs.reduce((acc, run) => acc + (run.total_tests || 0), 0);
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : "0.0";

  const trendChartData = useMemo(
    () =>
      trendData.map((point) => ({
        ...point,
        label: formatDateOnly(point.date),
      })),
    [trendData],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-3 py-4 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-w-0 max-w-7xl flex-col gap-3 sm:gap-6">
        <header className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/70 p-3 sm:p-4 md:p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="mb-3 sm:mb-4 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 sm:space-y-3 flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300">Quality Analytics</p>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-semibold tracking-tight">Metrics overview</h1>
              <div>
                <p className="mt-1 sm:mt-3 max-w-2xl text-[11px] sm:text-sm md:text-base text-slate-300">
                  Metrics and analytics across all test runs. View trends, failures, and branch health.
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
              <button
                type="button"
                data-testid="refresh-button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-widest transition sm:px-5 sm:py-3 sm:text-[13px] ${
                  isRefreshing
                    ? "border-slate-700/40 bg-slate-900/60 text-slate-600 cursor-not-allowed"
                    : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-500/20"
                }`}
              >
                {isRefreshing ? (
                  <>
                    <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span className="hidden sm:inline">Loading</span>
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
              <button
                type="button"
                data-testid="back-to-home-button"
                onClick={() => router.push("/")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full border border-slate-600/40 bg-slate-800/60 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:border-slate-500/60 hover:text-slate-300 sm:px-5 sm:py-3 sm:text-[13px]"
              >
                <span className="hidden sm:inline">Back to</span> Home
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/75 p-2 sm:p-4 md:p-6 shadow-lg" data-testid="stats-total-runs">
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-400">Total Runs</p>
            <p className="mt-1 sm:mt-3 text-lg sm:text-3xl md:text-4xl font-semibold">{totalRuns}</p>
          </div>

          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/75 p-2 sm:p-4 md:p-6 shadow-lg" data-testid="stats-pass-rate">
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-400">Pass Rate</p>
            <p className="mt-1 sm:mt-3 text-lg sm:text-3xl md:text-4xl font-semibold">{passRate}%</p>
          </div>

          <div
            className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/75 p-2 sm:p-4 md:p-6 shadow-lg"
            data-testid="stats-passed-tests"
          >
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-400">Passed Tests</p>
            <p className="mt-1 sm:mt-3 text-lg sm:text-3xl md:text-4xl font-semibold text-emerald-300">{totalPassed}</p>
          </div>

          <div
            className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/75 p-2 sm:p-4 md:p-6 shadow-lg"
            data-testid="stats-failed-tests"
          >
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-400">Failed Tests</p>
            <p className="mt-1 sm:mt-3 text-lg sm:text-3xl md:text-4xl font-semibold text-rose-300">{totalFailed}</p>
          </div>
        </section>

        <section className="rounded-2xl sm:rounded-3xl border border-white/10 bg-slate-950/70 p-3 sm:p-4 md:p-6 shadow-2xl shadow-cyan-950/10">
          <div className="mb-3 sm:mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold">Test trends</h2>
              <p className="text-[10px] sm:text-sm text-slate-400">Daily passed vs failed runs over the last 30 days.</p>
            </div>
          </div>

          <div
            className="h-[240px] w-full min-w-0 overflow-hidden sm:h-[320px]"
            data-testid="test-trends-chart"
          >
            {trendChartData.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                Insufficient data to display trends.
              </p>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                initialDimension={{ width: 1, height: 1 }}
              >
                <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    minTickGap={32}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis stroke="#94a3b8" width={40} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "1rem",
                    }}
                    formatter={trendTooltipFormatter}
                    labelFormatter={(label) => `Day: ${label}`}
                  />
                  <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={3} />
                  <Line type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <TopFailuresWidget />
          <FlakyTestsWidget />
          <BranchHealthWidget />
        </section>
      </div>
    </main>
  );
}
