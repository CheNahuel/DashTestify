import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import path from "path";
import simpleGit from "simple-git";

import { createAiProvider, parseAiProviderName } from "../../../../../scripts/ai/factory";
import { applyGeneratedPatch } from "../../../../../scripts/ai/patch";
import { readSourceFileContext } from "../../../../../scripts/ai/source-context";

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

const repoRoot = process.cwd();

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY are required for analytics AI actions.");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getRepoRelativePath(targetFile: string) {
  return path.isAbsolute(targetFile) ? path.relative(repoRoot, targetFile) : targetFile.replace(/^\.\/+/, "");
}

async function getCurrentBranchName() {
  const git = simpleGit(repoRoot);
  const branchSummary = await git.branchLocal().catch(() => null);

  return branchSummary?.current || "current branch";
}

function isHostedApplyEnvironment() {
  return process.env.VERCEL === "1";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as AnalyzeRequestBody | null;

    if (!body?.action) {
      return NextResponse.json({ error: "Missing action." }, { status: 400 });
    }

    if (body.action === "analyze") {
      const supabase = getSupabaseClient();
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
          .eq("error_message", failure.errorMessage)
          .maybeSingle();

        if (existing) {
          skipped.push(failure.testName);
          continue;
        }

        const sourceContext = await readSourceFileContext(repoRoot, failure.suite);
        const analysis = await analyzer.analyzeFailure({
          testName: failure.testName,
          errorMessage: failure.errorMessage,
          suite: failure.suite,
          runId: failure.runId,
          sourceFilePath: sourceContext?.path,
          sourceFileContent: sourceContext?.content,
          sourceFileTruncated: sourceContext?.truncated,
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
      const supabase = getSupabaseClient();
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

      if (isHostedApplyEnvironment()) {
        return NextResponse.json(
          { error: "Hosted AI apply needs a Git provider workflow before it can create branches or merge requests." },
          { status: 501 },
        );
      }

      const branchName = await getCurrentBranchName();
      const appliedPatch = await applyGeneratedPatch(repoRoot, analysis.generated_patch, {
        targetFileHint: analysis.target_file,
      });

      const filePath = appliedPatch?.filePath || getRepoRelativePath(analysis.target_file);

      return NextResponse.json({
        branchName,
        applyMode: "local",
        committed: false,
        analysisId: analysis.id,
        filePath,
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics AI action failed." },
      { status: 500 },
    );
  }
}
