"use client";

import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BranchHealthWidget } from "@/components/qa-analytics/branch-health-widget";
import { FlakyTestsWidget } from "@/components/qa-analytics/flaky-tests-widget";
import { TopFailuresWidget } from "@/components/qa-analytics/top-failures-widget";
import { Badge } from "@/components/ui/badge";
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
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function LiveQaAnalyticsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let mounted = true;

    async function loadRuns() {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (mounted) {
        setRuns((data || []) as TestRun[]);
      }
    }

    async function loadTrends() {
      try {
        const response = await fetch("/api/qa-analytics/test-trends?days=30");
        const payload = (await response.json()) as TestTrendsResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load test trends.");
        }

        if (mounted) {
          setTrendData(payload.data || []);
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setTrendData([]);
        }
      }
    }

    void loadRuns();
    void loadTrends();

    return () => {
      mounted = false;
    };
  }, []);

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_40%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">QA Analytics Live</p>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Metrics overview</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                Live metrics only. This page shows the aggregate health of test runs and the historical trend chart.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg" data-testid="stats-total-runs">
            <p className="text-sm text-slate-400">Total Runs</p>
            <p className="mt-3 text-4xl font-semibold">{totalRuns}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 shadow-lg" data-testid="stats-pass-rate">
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
              <p className="text-sm text-slate-400">Daily passed vs failed runs over the last 30 days.</p>
            </div>
          </div>

          <div className="h-[320px] w-full min-w-0" data-testid="test-trends-chart">
            {trendChartData.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
                No hay datos suficientes
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={320} minWidth={0}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
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

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          <Badge variant="secondary">Live</Badge>
          AI provider, latest run failures, AI analysis, and run detail cards are intentionally hidden here.
        </div>
      </div>
    </main>
  );
}
