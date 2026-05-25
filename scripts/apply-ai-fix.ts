import "dotenv/config";

import path from "path";

import { createClient } from "@supabase/supabase-js";

import { applyGeneratedPatch, checkoutBranchFromBase } from "./ai";

type AnalysisRow = {
  id: string | number;
  run_id: string | number;
  test_name: string;
  target_file: string | null;
  generated_patch: string | null;
};

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

async function getSourceBranchContext(runId: string | number) {
  const { data: run, error } = await supabase
    .from("test_runs")
    .select("branch, commit_sha")
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const baseRef = run?.commit_sha || run?.branch || "HEAD";

  return {
    branch: run?.branch ?? null,
    commit_sha: run?.commit_sha ?? null,
    baseRef,
  };
}

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

  for (const analysis of (analyses || []) as AnalysisRow[]) {
    if (!analysis.target_file || !analysis.generated_patch) {
      console.log(`Skipping ${analysis.test_name} - missing patch info`);
      continue;
    }

    const branchName = `ai-fix/${analysis.id}`;
    console.log(`Creating branch: ${branchName}`);
    const sourceContext = await getSourceBranchContext(analysis.run_id);
    const git = await checkoutBranchFromBase(process.cwd(), branchName, sourceContext.baseRef);

    await applyGeneratedPatch(process.cwd(), analysis.generated_patch, {
      targetFileHint: analysis.target_file,
    });

    const filePath = path.isAbsolute(analysis.target_file)
      ? path.relative(process.cwd(), analysis.target_file)
      : analysis.target_file.replace(/^\.\/+/, "");

    console.log(`Applied patch for: ${filePath}`);

    await git.add(filePath);
    await git.commit(`AI-generated fix for ${analysis.test_name}`);

    console.log(`Committed AI fix for ${analysis.test_name}`);
  }
}

main();
