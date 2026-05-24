"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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
  test_name: string;
  status: string;
};

type FailingTest = {
  test_name: string;
  failures: number;
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
};

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [failingTests, setFailingTests] = useState<FailingTest[]>([]);
  const [flakyTests, setFlakyTests] = useState<FlakyTest[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis[]>([]);

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
          if (!acc[test.test_name]) {
            acc[test.test_name] = {
              test_name: test.test_name,
              failures: 0,
            };
          }

          acc[test.test_name].failures++;

          return acc;
        }, {}),
      );

      grouped.sort((a, b) => b.failures - a.failures);

      setFailingTests(grouped.slice(0, 5));
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
        if (!grouped[test.test_name]) {
          grouped[test.test_name] = {
            test_name: test.test_name,
            statuses: new Set(),
          };
        }

        grouped[test.test_name].statuses.add(test.status);
      }

      const flaky = Object.values(grouped)
        .filter((test) => {
          return test.statuses.has("passed") && test.statuses.has("failed");
        })
        .map((test) => ({
          test_name: test.test_name,
        }));

      setFlakyTests(flaky);
    }
    async function loadAiAnalysis() {
      const { data, error } = await supabase.from("ai_analysis").select("*").order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error(error);
        return;
      }

      setAiAnalysis((data || []) as AiAnalysis[]);
    }
    loadRuns();
    loadFailingTests();
    loadFlakyTests();
    loadAiAnalysis();
  }, []);

  const totalRuns = runs.length;

  const totalPassed = runs.reduce((acc, run) => acc + (run.passed || 0), 0);

  const totalFailed = runs.reduce((acc, run) => acc + (run.failed || 0), 0);

  const totalTests = runs.reduce((acc, run) => acc + (run.total_tests || 0), 0);

  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  const chartData = [...runs].reverse().map((run) => ({
    date: new Date(run.created_at).toLocaleDateString(),
    passed: run.passed,
    failed: run.failed,
  }));

  return (
    <main className="p-8 min-h-screen">
      <h1 className="text-4xl font-bold mb-8">QA Analytics</h1>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-2xl p-6">
          <p className="text-sm opacity-70 mb-2">Total Runs</p>

          <p className="text-4xl font-bold">{totalRuns}</p>
        </div>

        <div className="border rounded-2xl p-6">
          <p className="text-sm opacity-70 mb-2">Pass Rate</p>

          <p className="text-4xl font-bold">{passRate}%</p>
        </div>

        <div className="border rounded-2xl p-6">
          <p className="text-sm opacity-70 mb-2">Passed Tests</p>

          <p className="text-4xl font-bold">{totalPassed}</p>
        </div>

        <div className="border rounded-2xl p-6">
          <p className="text-sm opacity-70 mb-2">Failed Tests</p>

          <p className="text-4xl font-bold">{totalFailed}</p>
        </div>
      </div>

      {/* CHART */}
      <div className="border rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Test Trends</h2>

        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="date" />

              <YAxis />

              <Tooltip />

              <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={3} />

              <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MOST FAILING TESTS */}
      <div className="border rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Most Failing Tests</h2>

        <div className="space-y-4">
          {failingTests.map((test) => (
            <div key={test.test_name} className="flex justify-between border-b pb-2">
              <p>{test.test_name}</p>

              <p className="font-bold">{test.failures} failures</p>
            </div>
          ))}
        </div>
      </div>

      {/* FLAKY TESTS */}
      <div className="border rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Flaky Tests</h2>

        <div className="space-y-4">
          {flakyTests.length === 0 && <p>No flaky tests detected 🎉</p>}

          {flakyTests.map((test) => (
            <div key={test.test_name} className="flex justify-between border-b pb-2">
              <p>{test.test_name}</p>

              <p className="font-bold text-yellow-500">Flaky</p>
            </div>
          ))}
        </div>
      </div>
      {/* AI ANALYSIS */}
      <div className="border rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">AI Failure Analysis</h2>

        <div className="space-y-4">
          {aiAnalysis.length === 0 && <p>No AI analysis available yet.</p>}

          {aiAnalysis.map((analysis) => (
            <div key={analysis.id} className="border rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <p className="font-semibold text-lg">{analysis.test_name}</p>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    analysis.severity === "high"
                      ? "bg-red-500/20 text-red-500"
                      : analysis.severity === "medium"
                        ? "bg-yellow-500/20 text-yellow-500"
                        : "bg-green-500/20 text-green-500"
                  }`}
                >
                  {analysis.severity}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm opacity-70 mb-1">AI Summary</p>

                  <p>{analysis.ai_summary}</p>
                </div>

                <div>
                  <p className="text-sm opacity-70 mb-1">Suggested Fix</p>

                  <p>{analysis.suggested_fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RUNS */}
      <div className="space-y-4">
        {runs.map((run) => (
          <div key={run.id} className="border rounded-2xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-lg font-semibold">Branch: {run.branch || "unknown"}</p>

                <p className="text-sm opacity-70">{new Date(run.created_at).toLocaleString()}</p>
              </div>

              <div className="text-right">
                <p className="text-sm opacity-70">Commit</p>

                <p className="font-mono text-sm">
                  {run.commit_sha ? run.commit_sha.slice(0, 7) : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm opacity-70">Passed</p>

                <p className="text-2xl font-bold">{run.passed}</p>
              </div>

              <div>
                <p className="text-sm opacity-70">Failed</p>

                <p className="text-2xl font-bold">{run.failed}</p>
              </div>

              <div>
                <p className="text-sm opacity-70">Total</p>

                <p className="text-2xl font-bold">{run.total_tests}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
