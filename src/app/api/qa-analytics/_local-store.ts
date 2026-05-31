import fs from "fs/promises";
import os from "os";
import path from "path";

import simpleGit from "simple-git";

import { buildLocalQaAnalyticsSnapshot, type PlaywrightJsonFile } from "@/lib/qa-analytics/local-results";

import type { LocalAiAnalysis } from "@/components/qa-analytics/types";

type StoredAiAnalysis = LocalAiAnalysis & {
  created_at: string;
};

const repoRoot = process.cwd();
const localResultsPath = path.join(repoRoot, "test-results", "results.json");
const localAnalysesPath = path.join(os.tmpdir(), "dash-testify-qa-analytics", "qa-analytics-ai.json");

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function getCurrentGitState() {
  try {
    const git = simpleGit(repoRoot);
    const [branchSummary, commitSha] = await Promise.all([
      git.branchLocal().catch(() => null),
      git.revparse(["HEAD"]).catch(() => null),
    ]);

    return {
      branch: branchSummary?.current || "unknown branch",
      commitSha: commitSha?.trim() || null,
    };
  } catch {
    return {
      branch: "unknown branch",
      commitSha: null,
    };
  }
}

export async function loadLocalQaAnalyticsSnapshot() {
  const [resultsFile, aiAnalysesFile, gitState] = await Promise.all([
    readJsonFile<PlaywrightJsonFile>(localResultsPath),
    readJsonFile<StoredAiAnalysis[]>(localAnalysesPath),
    getCurrentGitState(),
  ]);
  return buildLocalQaAnalyticsSnapshot({
    resultsFile,
    aiAnalysesFile,
    gitState,
  });
}

export async function loadLocalAnalysisById(analysisId: string | number) {
  const analyses = (await readJsonFile<StoredAiAnalysis[]>(localAnalysesPath)) || [];

  return analyses.find((analysis) => String(analysis.id) === String(analysisId)) || null;
}

export async function loadLocalAnalysesForRun(runId: string | number) {
  const analyses = (await readJsonFile<StoredAiAnalysis[]>(localAnalysesPath)) || [];

  return analyses
    .filter((analysis) => String(analysis.run_id) === String(runId))
    .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""));
}

export async function appendLocalAnalyses(analyses: StoredAiAnalysis[]) {
  const existing = (await readJsonFile<StoredAiAnalysis[]>(localAnalysesPath)) || [];
  const seen = new Set(existing.map((analysis) => String(analysis.id)));
  const next = [...existing];

  for (const analysis of analyses) {
    if (seen.has(String(analysis.id))) {
      continue;
    }

    seen.add(String(analysis.id));
    next.push(analysis);
  }

  await writeJsonFile(localAnalysesPath, next);
}

export async function overwriteLocalAnalysis(analysis: StoredAiAnalysis) {
  const existing = (await readJsonFile<StoredAiAnalysis[]>(localAnalysesPath)) || [];
  const next = existing.filter((item) => String(item.id) !== String(analysis.id));
  next.push(analysis);
  await writeJsonFile(localAnalysesPath, next);
}
