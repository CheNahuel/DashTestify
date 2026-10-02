import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const LIVE_BENCHMARK_DATASET = "semantic-grounding-live-v1";
export const LIVE_BENCHMARK_OUTPUT = "evals/.output/live-grounding-latest.json";
export const LIVE_BENCHMARK_SUMMARY = "evals/.output/live-grounding-summary.json";

export type LiveBenchmarkSummary = {
  analystProvider: string;
  analystModel: string;
  judgeProvider: string;
  judgeModel: string;
  dataset: string;
  datasetVersion: string;
  productionPath: "analyzeCryptoQuery";
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    averageScore: number | null;
  };
  cases: Array<{
    id: string;
    query: string;
    pass: boolean | null;
    score: number | null;
    status: "PASS" | "FAIL" | "ERROR";
    reason?: string;
    error?: string;
  }>;
};

type PromptfooRow = {
  success?: boolean;
  score?: number;
  error?: string;
  response?: { output?: unknown };
  vars?: { query?: unknown };
  testCase?: { metadata?: { id?: unknown } };
  gradingResult?: {
    pass?: boolean;
    score?: number;
    reason?: string;
    componentResults?: Array<{ pass?: boolean; score?: number; reason?: string }>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractRows(payload: unknown): PromptfooRow[] {
  const root = asRecord(payload);
  const nested = asRecord(root.results);
  if (Array.isArray(nested.results)) {
    return nested.results as PromptfooRow[];
  }
  if (Array.isArray(root.results)) {
    return root.results as PromptfooRow[];
  }
  return [];
}

export async function writeLiveBenchmarkSummary(input: {
  analystProvider: string;
  analystModel: string;
  judgeProvider: string;
  judgeModel: string;
  promptfooOutputPath?: string;
  summaryOutputPath?: string;
}): Promise<LiveBenchmarkSummary> {
  const promptfooPath = input.promptfooOutputPath ?? LIVE_BENCHMARK_OUTPUT;
  const summaryPath = input.summaryOutputPath ?? LIVE_BENCHMARK_SUMMARY;
  const raw = await readFile(path.join(process.cwd(), promptfooPath), "utf8");
  const payload = JSON.parse(raw) as unknown;
  const rows = extractRows(payload);

  const cases = rows.map((row, index) => {
    const metadata = asRecord(row.testCase?.metadata);
    const id = typeof metadata.id === "string" ? metadata.id : `case-${index + 1}`;
    const query = typeof row.vars?.query === "string" ? row.vars.query : "";
    const component = row.gradingResult?.componentResults?.[0];
    const score =
      typeof component?.score === "number"
        ? component.score
        : typeof row.gradingResult?.score === "number"
          ? row.gradingResult.score
          : typeof row.score === "number"
            ? row.score
            : null;
    const reason = component?.reason ?? row.gradingResult?.reason;
    const error = typeof row.error === "string" && row.error.trim() ? row.error : undefined;

    let status: "PASS" | "FAIL" | "ERROR" = "FAIL";
    let pass: boolean | null = false;
    const graded =
      component !== undefined || row.gradingResult !== undefined || row.success !== undefined;
    if (row.success === true || component?.pass === true || row.gradingResult?.pass === true) {
      status = "PASS";
      pass = true;
    } else if (graded && !error?.startsWith("Judge ")) {
      status = "FAIL";
      pass = false;
    } else if (error) {
      status = "ERROR";
      pass = null;
    }

    return {
      id,
      query,
      pass,
      score,
      status,
      reason,
      error: status === "ERROR" ? error : undefined,
    };
  });

  const scored = cases.map((item) => item.score).filter((value): value is number => typeof value === "number");
  const summary: LiveBenchmarkSummary = {
    analystProvider: input.analystProvider,
    analystModel: input.analystModel,
    judgeProvider: input.judgeProvider,
    judgeModel: input.judgeModel,
    dataset: LIVE_BENCHMARK_DATASET,
    datasetVersion: LIVE_BENCHMARK_DATASET,
    productionPath: "analyzeCryptoQuery",
    timestamp: new Date().toISOString(),
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.status === "PASS").length,
      failed: cases.filter((item) => item.status === "FAIL").length,
      errors: cases.filter((item) => item.status === "ERROR").length,
      skipped: 0,
      averageScore:
        scored.length > 0 ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null,
    },
    cases,
  };

  await mkdir(path.dirname(path.join(process.cwd(), summaryPath)), { recursive: true });
  await writeFile(path.join(process.cwd(), summaryPath), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

export function printLiveBenchmarkSummary(summary: LiveBenchmarkSummary): void {
  console.log("LLM_EVAL_BENCHMARK=COMPLETE");
  console.log(
    `analystProvider=${summary.analystProvider} analystModel=${summary.analystModel} ` +
      `judgeProvider=${summary.judgeProvider} judgeModel=${summary.judgeModel} ` +
      `dataset=${summary.dataset} productionPath=${summary.productionPath}`,
  );
  console.log(
    `aggregate total=${summary.summary.total} passed=${summary.summary.passed} ` +
      `failed=${summary.summary.failed} errors=${summary.summary.errors} ` +
      `averageScore=${summary.summary.averageScore ?? "n/a"}`,
  );
  for (const item of summary.cases) {
    console.log(`case ${item.id} status=${item.status} score=${item.score ?? "n/a"} query=${item.query}`);
  }
}
