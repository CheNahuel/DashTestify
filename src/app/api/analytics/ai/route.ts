import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import path from "path";

import { applyGeneratedPatch, checkoutBranchFromBase, createAiProvider, parseAiProviderName } from "@/lib/ai";

export const runtime = "nodejs";

type AiFailureInput = {
  runId: string | number;
  testName: string;
  errorMessage: string;
  suite?: string | null;
};

type AnalyzeRequestBody = {
  action?: "analyze" | "apply";
  provider?: string;
  failures?: AiFailureInput[];
  failure?: AiFailureInput;
  analysisId?: string | number;
};

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

function getRepoRelativePath(targetFile: string) {
  return path.isAbsolute(targetFile) ? path.relative(process.cwd(), targetFile) : targetFile.replace(/^\.\/+/, "");
}

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AnalyzeRequestBody | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  if (body.action === "analyze") {
    const provider = parseAiProviderName(body.provider);
    const analyzer = createAiProvider(provider);
    const failures = body.failures ?? (body.failure ? [body.failure] : []);

    if (failures.length === 0) {
      return NextResponse.json({ error: "No failures provided." }, { status: 400 });
    }

    const analyses: unknown[] = [];
    const skipped: string[] = [];

    for (const failure of failures) {
      const { data: existing } = await supabase
        .from("ai_analysis")
        .select("id")
        .eq("run_id", failure.runId)
        .eq("test_name", failure.testName)
        .maybeSingle();

      if (existing) {
        skipped.push(failure.testName);
        continue;
      }

      const analysis = await analyzer.analyzeFailure({
        testName: failure.testName,
        errorMessage: failure.errorMessage,
        suite: failure.suite,
        runId: failure.runId,
      });

      const { data: inserted, error } = await supabase
        .from("ai_analysis")
        .insert({
          run_id: failure.runId,
          test_name: failure.testName,
          error_message: failure.errorMessage,
          ai_summary: analysis.summary,
          suggested_fix: analysis.suggested_fix,
          severity: analysis.severity,
          classification: analysis.classification,
          confidence: analysis.confidence,
          target_file: analysis.target_file,
          generated_patch: analysis.generated_patch,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      analyses.push(inserted);
    }

    return NextResponse.json({
      analyses,
      skipped,
      provider,
    });
  }

  if (body.action === "apply") {
    if (!body.analysisId) {
      return NextResponse.json({ error: "Missing analysisId." }, { status: 400 });
    }

    const { data: analysis, error } = await supabase
      .from("ai_analysis")
      .select("*")
      .eq("id", body.analysisId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!analysis?.target_file || !analysis?.generated_patch) {
      return NextResponse.json({ error: "Analysis is missing patch information." }, { status: 400 });
    }

    const branchName = `ai-fix/${analysis.id}`;
    const sourceContext = await getSourceBranchContext(analysis.run_id);
    const git = await checkoutBranchFromBase(process.cwd(), branchName, sourceContext.baseRef);

    await applyGeneratedPatch(process.cwd(), analysis.generated_patch, {
      targetFileHint: analysis.target_file,
    });

    const filePath = getRepoRelativePath(analysis.target_file);

    await git.add(filePath);
    await git.commit(`AI-generated fix for ${analysis.test_name}`);

    return NextResponse.json({
      branchName,
      analysisId: analysis.id,
      filePath,
      sourceBranch: sourceContext.branch,
      sourceCommitSha: sourceContext.commit_sha,
      sourceBaseRef: sourceContext.baseRef,
    });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
