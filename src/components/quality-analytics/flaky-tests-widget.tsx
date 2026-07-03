"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FlakyTest = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
  pass_rate: number;
};

type FlakyTestsResponse = {
  data?: FlakyTest[];
  error?: string;
};

export function FlakyTestsWidget() {
  const [items, setItems] = useState<FlakyTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quality-analytics/flaky-tests");
      const payload = (await response.json()) as FlakyTestsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load flaky tests.");
      }

      setItems(payload.data || []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load flaky tests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <Card data-testid="flaky-tests-widget">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Flaky tests</CardTitle>
          <CardDescription>Tests that have both passes and failures in the last 30 days.</CardDescription>
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
        {loading && <p className="text-sm text-slate-300">Loading flaky tests...</p>}

        {!loading && error && <p className="text-sm text-rose-200">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-300">No flaky tests in the last 30 days.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={`${item.test_name}-${item.suite}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-base font-semibold text-white">{item.test_name}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.suite}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failures</p>
                    <p className="text-sm sm:text-lg font-semibold text-rose-200">{item.total_failures}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Passes</p>
                    <p className="text-sm sm:text-lg font-semibold text-emerald-200">{item.total_passes}</p>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pass rate</p>
                    <p className="text-sm sm:text-lg font-semibold text-cyan-200">{item.pass_rate}%</p>
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
