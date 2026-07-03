import { NextResponse } from "next/server";

import { DEFAULT_ANALYTICS_DAYS, loadAnalyticsWindow, parseDaysParam } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BranchHealthRow = {
  branch: string;
  total_runs: number;
  failed_runs: number;
  passed_runs: number;
  pass_rate: number;
  unique_tests_failed: number;
  last_run: string | null;
};

type BranchAggregate = {
  branch: string;
  total_runs: number;
  failed_runs: number;
  passed_runs: number;
  failedTests: Set<string>;
  last_run: string | null;
};

function getDisplayValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseDaysParam(searchParams, DEFAULT_ANALYTICS_DAYS);
    const { runs, results } = await loadAnalyticsWindow(days);
    const aggregates = new Map<string, BranchAggregate>();

    for (const run of runs) {
      const branch = getDisplayValue(run.branch, "Unknown branch");

      if (!aggregates.has(branch)) {
        aggregates.set(branch, {
          branch,
          total_runs: 0,
          failed_runs: 0,
          passed_runs: 0,
          failedTests: new Set<string>(),
          last_run: null,
        });
      }

      const aggregate = aggregates.get(branch)!;
      aggregate.total_runs += 1;

      if ((run.failed ?? 0) > 0) {
        aggregate.failed_runs += 1;
      } else {
        aggregate.passed_runs += 1;
      }

      if (!aggregate.last_run || run.created_at > aggregate.last_run) {
        aggregate.last_run = run.created_at;
      }
    }

    for (const result of results) {
      if (result.status !== "failed") {
        continue;
      }

      const branch = getDisplayValue(result.run.branch, "Unknown branch");
      const aggregate = aggregates.get(branch);

      if (!aggregate) {
        continue;
      }

      const testName = getDisplayValue(result.test_name, "Unknown test");
      const suite = getDisplayValue(result.suite, "Unknown suite");
      aggregate.failedTests.add(`${testName}::${suite}`);
    }

    const data: BranchHealthRow[] = Array.from(aggregates.values())
      .map((aggregate) => {
        const passRate = aggregate.total_runs > 0 ? Number(((aggregate.passed_runs / aggregate.total_runs) * 100).toFixed(1)) : 0;

        return {
          branch: aggregate.branch,
          total_runs: aggregate.total_runs,
          failed_runs: aggregate.failed_runs,
          passed_runs: aggregate.passed_runs,
          pass_rate: passRate,
          unique_tests_failed: aggregate.failedTests.size,
          last_run: aggregate.last_run,
        };
      })
      .sort((left, right) => right.failed_runs - left.failed_runs || right.total_runs - left.total_runs);

    return NextResponse.json({ data, days });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load branch health.",
      },
      { status: 500 },
    );
  }
}
