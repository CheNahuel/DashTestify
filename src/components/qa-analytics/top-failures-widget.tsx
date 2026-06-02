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

  return new Intl.DateTimeFormat("es-AR", {
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
          <p className="text-sm text-slate-300">No hay datos suficientes</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Failures</th>
                  <th className="px-4 py-3">Passes</th>
                  <th className="px-4 py-3">Pass rate</th>
                  <th className="px-4 py-3">Branches</th>
                  <th className="px-4 py-3">Last failed</th>
                  <th className="px-4 py-3">Latest error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => (
                  <tr key={`${item.test_name}-${item.suite}`} className="align-top">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-white">{item.test_name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.suite}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-rose-200">{item.total_failures}</td>
                    <td className="px-4 py-4 text-emerald-200">{item.total_passes}</td>
                    <td className="px-4 py-4">
                      <Badge variant="secondary">{item.pass_rate}%</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {item.branches_affected.map((branch) => (
                          <Badge key={branch} variant="outline">
                            {branch}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(item.last_failed_at)}</td>
                    <td className="px-4 py-4 text-slate-300">{item.latest_error || "No error message"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
