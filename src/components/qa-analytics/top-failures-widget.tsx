"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TopFailure = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
  pass_rate: number;
  branches_affected: string[];
  last_failed_at: string | null;
  latest_error: string | null;
};

type TopFailuresResponse = {
  data?: TopFailure[];
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function TopFailuresWidget() {
  const [items, setItems] = useState<TopFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/qa-analytics/top-failures");
      const payload = (await response.json()) as TopFailuresResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load top failures.");
      }

      setItems(payload.data || []);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load top failures.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <Card data-testid="top-failures-widget">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Top failures</CardTitle>
          <CardDescription>Most failing tests from the last 30 days.</CardDescription>
        </div>

        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {loading && <p className="text-sm text-slate-300">Loading top failures...</p>}

        {!loading && error && <p className="text-sm text-rose-200">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-300">No top failures in the last 30 days.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={`${item.test_name}-${item.suite}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="space-y-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-semibold text-white">{item.test_name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.suite}</p>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failures</p>
                      <p className="mt-2 text-lg font-semibold text-rose-200">{item.total_failures}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Passes</p>
                      <p className="mt-2 text-lg font-semibold text-emerald-200">{item.total_passes}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pass rate</p>
                      <p className="mt-2 text-lg font-semibold text-cyan-200">{item.pass_rate}%</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last failed</p>
                      <p className="mt-2 text-sm text-slate-300">{formatDate(item.last_failed_at)}</p>
                    </div>
                  </div>

                  {item.branches_affected.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Affected branches</p>
                      <div className="flex flex-wrap gap-2">
                        {item.branches_affected.map((branch) => (
                          <Badge key={branch} variant="outline">
                            {branch}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.latest_error && (
                    <div className="max-h-24 overflow-y-auto rounded-lg bg-white/5 p-2">
                      <p className="whitespace-pre-wrap text-sm text-slate-300">
                        {item.latest_error}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
