import { createClient } from "@supabase/supabase-js";

export const DEFAULT_ANALYTICS_DAYS = 30;

export type AnalyticsRunRow = {
  id: string | number;
  branch: string | null;
  commit_sha: string | null;
  created_at: string;
  passed: number | null;
  failed: number | null;
  total_tests: number | null;
};

export type AnalyticsResultRow = {
  run_id: string | number;
  suite: string | null;
  test_name: string | null;
  status: string;
  error_message: string | null;
  retry?: number | null;
};

export type JoinedAnalyticsResultRow = AnalyticsResultRow & {
  run: AnalyticsRunRow;
};

export type AnalyticsWindow = {
  runs: AnalyticsRunRow[];
  results: JoinedAnalyticsResultRow[];
  sinceIso: string;
};

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY are required for QA analytics routes.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export function parseDaysParam(searchParams: URLSearchParams, fallback = DEFAULT_ANALYTICS_DAYS) {
  const parsed = Number.parseInt(searchParams.get("days") || "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 365);
}

export function createSinceDate(days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  return since;
}

export function toDateKey(value: string) {
  return value.slice(0, 10);
}

export function formatIsoDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function loadAnalyticsWindow(days: number): Promise<AnalyticsWindow> {
  const supabase = getSupabaseClient();
  const since = createSinceDate(days);
  const sinceIso = since.toISOString();

  const { data: runsData, error: runsError } = await supabase
    .from("test_runs")
    .select("id, branch, commit_sha, created_at, passed, failed, total_tests")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  if (runsError) {
    throw new Error(runsError.message);
  }

  const runs = (runsData || []) as AnalyticsRunRow[];

  if (runs.length === 0) {
    return {
      runs: [],
      results: [],
      sinceIso,
    };
  }

  const runIds = runs.map((run) => run.id);
  const { data: resultsData, error: resultsError } = await supabase
    .from("test_results")
    .select("run_id, suite, test_name, status, error_message, retry")
    .in("run_id", runIds);

  if (resultsError) {
    throw new Error(resultsError.message);
  }

  const runById = new Map(runs.map((run) => [String(run.id), run]));
  const results = (resultsData || [])
    .map((result) => {
      const run = runById.get(String(result.run_id));
      return run ? ({ ...result, run } as JoinedAnalyticsResultRow) : null;
    })
    .filter(Boolean) as JoinedAnalyticsResultRow[];

  return {
    runs,
    results,
    sinceIso,
  };
}
