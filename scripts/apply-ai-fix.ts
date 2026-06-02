import "dotenv/config";

import path from "path";

import { createClient } from "@supabase/supabase-js";
import simpleGit from "simple-git";

import { applyGeneratedPatch } from "./ai";

type AnalysisRow = {
  id: string | number;
  run_id: string | number;
  test_name: string;
  error_message: string | null;
  target_file: string | null;
  generated_patch: string | null;
};

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function main() {
  const { data: analyses, error } = await supabase
    .from("ai_analysis")
    .select("*")
    .eq("classification", "test_issue")
    .gte("confidence", 90);

  if (error) {
    console.error(error);
    return;
  }

  const seenAnalyses = new Set<string>();

  for (const analysis of (analyses || []) as AnalysisRow[]) {
    const canonicalKey = `${analysis.run_id}::${analysis.test_name}::${analysis.error_message || ""}`;

    if (seenAnalyses.has(canonicalKey)) {
      console.log(`Skipping duplicate analysis: ${analysis.test_name}`);
      continue;
    }

    seenAnalyses.add(canonicalKey);

    if (!analysis.target_file || !analysis.generated_patch) {
      console.log(`Skipping ${analysis.test_name} - missing patch info`);
      continue;
    }

    const git = simpleGit(process.cwd());
    const branchSummary = await git.branchLocal().catch(() => null);
    const currentBranch = branchSummary?.current || "current branch";
    const appliedPatch = await applyGeneratedPatch(process.cwd(), analysis.generated_patch, {
      targetFileHint: analysis.target_file,
    });

    const filePath = appliedPatch?.filePath || (path.isAbsolute(analysis.target_file)
      ? path.relative(process.cwd(), analysis.target_file)
      : analysis.target_file.replace(/^\.\/+/, ""));

    console.log(`Applied patch on ${currentBranch} for: ${filePath}`);
  }
}

main();
