import { NextResponse } from "next/server";

import {
  DEFAULT_ANALYTICS_DAYS,
  formatIsoDateTime,
  loadAnalyticsWindow,
  parseDaysParam,
  type JoinedAnalyticsResultRow,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TopFailureRow = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
  pass_rate: number;
  branches_affected: string[];
  last_failed_at: string | null;
  latest_error: string | null;
};

type FailureAggregate = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
  branches: Set<string>;
  last_failed_at: string | null;
  latest_error: string | null;
};

function getDisplayValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function buildAggregateRow(result: JoinedAnalyticsResultRow) {
  return {
    testName: getDisplayValue(result.test_name, "Unknown test"),
    suite: getDisplayValue(result.suite, "Unknown suite"),
    branch: getDisplayValue(result.run.branch, "Unknown branch"),
    createdAt: result.run.created_at,
    errorMessage: result.error_message?.trim() || null,
    status: result.status,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams, DEFAULT_ANALYTICS_DAYS);
    const { results } = await loadAnalyticsWindow(days);
    const aggregates = new Map<string, FailureAggregate>();

    for (const result of results) {
      const row = buildAggregateRow(result);
      const key = `${row.testName}::${row.suite}`;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          test_name: row.testName,
          suite: row.suite,
          total_failures: 0,
          total_passes: 0,
          branches: new Set<string>(),
          last_failed_at: null,
          latest_error: null,
        });
      }

      const aggregate = aggregates.get(key)!;

      if (row.status === "failed") {
        aggregate.total_failures += 1;
        aggregate.branches.add(row.branch);

        const nextFailedAt = formatIsoDateTime(row.createdAt);
        if (nextFailedAt && (!aggregate.last_failed_at || nextFailedAt > aggregate.last_failed_at)) {
          aggregate.last_failed_at = nextFailedAt;
          aggregate.latest_error = row.errorMessage;
        }
      }

      if (row.status === "passed") {
        aggregate.total_passes += 1;
      }
    }

    const data: TopFailureRow[] = Array.from(aggregates.values())
      .filter((aggregate) => aggregate.total_failures > 0)
      .map((aggregate) => {
        const total = aggregate.total_failures + aggregate.total_passes;
        const passRate = total > 0 ? Number(((aggregate.total_passes / total) * 100).toFixed(1)) : 0;

        return {
          test_name: aggregate.test_name,
          suite: aggregate.suite,
          total_failures: aggregate.total_failures,
          total_passes: aggregate.total_passes,
          pass_rate: passRate,
          branches_affected: Array.from(aggregate.branches).sort((left, right) => left.localeCompare(right)),
          last_failed_at: aggregate.last_failed_at,
          latest_error: aggregate.latest_error,
        };
      })
      .sort((left, right) => right.total_failures - left.total_failures || left.test_name.localeCompare(right.test_name))
      .slice(0, 10);

    return NextResponse.json({ data, days });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load top failures.",
      },
      { status: 500 },
    );
  }
}
