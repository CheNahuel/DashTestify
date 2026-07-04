"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type BranchHealth = {
  branch: string;
  total_runs: number;
  failed_runs: number;
  passed_runs: number;
  pass_rate: number;
  unique_tests_failed: number;
  last_run: string | null;
};

type BranchHealthResponse = {
  data?: BranchHealth[];
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function BranchHealthWidget() {
  const [items, setItems] = useState<BranchHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quality-analytics/failures-by-branch");
      const payload = (await response.json()) as BranchHealthResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load branch health.");
      }

      setItems(payload.data || []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load branch health.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <Card data-testid="branch-health-widget">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Branch health</CardTitle>
          <CardDescription>
            Run health and unique failures grouped by branch for the last 30 days.
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0 self-start sm:self-auto"
          onClick={() => void loadData()}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {loading && <p className="text-sm text-slate-300">Loading branch health...</p>}

        {!loading && error && <p className="text-sm text-rose-200">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-300">No hay datos suficientes</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.branch} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-base font-semibold text-white">{item.branch}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Last run {formatDate(item.last_run)}
                    </p>
                  </div>

                  <Badge variant="outline">{item.pass_rate}% pass rate</Badge>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pass rate</p>
                    <p className="text-xs sm:text-sm font-medium text-slate-300">{item.pass_rate}%</p>
                  </div>

                  <Progress value={item.pass_rate} />
                </div>

                <div className="mt-5 grid gap-2 grid-cols-2 sm:grid-cols-4 sm:gap-3">
                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Runs</p>
                    <p className="text-sm sm:text-lg font-semibold text-white">{item.total_runs}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failed</p>
                    <p className="text-sm sm:text-lg font-semibold text-rose-200">{item.failed_runs}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Passed</p>
                    <p className="text-sm sm:text-lg font-semibold text-emerald-200">{item.passed_runs}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failed tests</p>
                    <p className="text-sm sm:text-lg font-semibold text-cyan-200">
                      {item.unique_tests_failed}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}