import { NextResponse } from "next/server";

import { DEFAULT_ANALYTICS_DAYS, loadAnalyticsWindow, parseDaysParam, toDateKey } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrendRow = {
  date: string;
  passed: number;
  failed: number;
  pass_rate: number;
};

function buildDateRange(days: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= new Date()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams, DEFAULT_ANALYTICS_DAYS);
    const { runs } = await loadAnalyticsWindow(days);
    const totalsByDay = new Map<string, { passed: number; failed: number }>();

    for (const run of runs) {
      const dateKey = toDateKey(run.created_at);
      const existing = totalsByDay.get(dateKey) || { passed: 0, failed: 0 };

      existing.passed += run.passed || 0;
      existing.failed += run.failed || 0;
      totalsByDay.set(dateKey, existing);
    }

    const data: TrendRow[] = buildDateRange(days).map((date) => {
      const totals = totalsByDay.get(date) || { passed: 0, failed: 0 };
      const total = totals.passed + totals.failed;
      const passRate = total > 0 ? Number(((totals.passed / total) * 100).toFixed(1)) : 0;

      return {
        date,
        passed: totals.passed,
        failed: totals.failed,
        pass_rate: passRate,
      };
    });

    return NextResponse.json({ data, days });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load test trends.",
      },
      { status: 500 },
    );
  }
}
