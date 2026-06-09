import { NextResponse } from "next/server";

import { DEFAULT_ANALYTICS_DAYS, loadAnalyticsWindow, parseDaysParam } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FlakyTestRow = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
  pass_rate: number;
};

type FlakyAggregate = {
  test_name: string;
  suite: string;
  total_failures: number;
  total_passes: number;
};

function getDisplayValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams, DEFAULT_ANALYTICS_DAYS);
    const { results } = await loadAnalyticsWindow(days);
    const aggregates = new Map<string, FlakyAggregate>();

    for (const result of results) {
      const testName = getDisplayValue(result.test_name, "Unknown test");
      const suite = getDisplayValue(result.suite, "Unknown suite");
      const key = `${testName}::${suite}`;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          test_name: testName,
          suite,
          total_failures: 0,
          total_passes: 0,
        });
      }

      const aggregate = aggregates.get(key)!;

      if (result.status === "failed") {
        aggregate.total_failures += 1;
      }

      if (result.status === "passed") {
        aggregate.total_passes += 1;
      }
    }

    const data: FlakyTestRow[] = Array.from(aggregates.values())
      .filter((aggregate) => aggregate.total_failures > 0 && aggregate.total_passes > 0)
      .map((aggregate) => {
        const total = aggregate.total_failures + aggregate.total_passes;
        const passRate = total > 0 ? Number(((aggregate.total_passes / total) * 100).toFixed(1)) : 0;

        return {
          test_name: aggregate.test_name,
          suite: aggregate.suite,
          total_failures: aggregate.total_failures,
          total_passes: aggregate.total_passes,
          pass_rate: passRate,
        };
      })
      .sort((left, right) => right.total_failures - left.total_failures || left.test_name.localeCompare(right.test_name));

    return NextResponse.json({ data, days });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load flaky tests.",
      },
      { status: 500 },
    );
  }
}
