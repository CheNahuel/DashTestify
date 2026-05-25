import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { createAiProvider, parseAiProviderName, readSourceFileContext } from "./ai";

type FailureRow = {
  run_id: string | number;
  test_name: string;
  error_message: string | null;
  suite?: string | null;
};

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

function readProviderName() {
  const providerArg = process.argv.find((arg) => arg.startsWith("--provider="));

  if (providerArg) {
    return parseAiProviderName(providerArg.split("=", 2)[1]);
  }

  const providerFlagIndex = process.argv.findIndex((arg) => arg === "--provider");

  if (providerFlagIndex >= 0) {
    return parseAiProviderName(process.argv[providerFlagIndex + 1]);
  }

  return parseAiProviderName(process.env.AI_PROVIDER);
}

async function main() {
  const analyzer = createAiProvider(readProviderName());

  const { data: failures, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("status", "failed")
    .not("error_message", "is", null);

  if (error) {
    console.error(error);
    return;
  }

  for (const failure of (failures || []) as FailureRow[]) {
    const { data: existing } = await supabase
      .from("ai_analysis")
      .select("id")
      .eq("run_id", failure.run_id)
      .eq("test_name", failure.test_name)
      .maybeSingle();

    if (existing) {
      console.log(`Skipping already analyzed test: ${failure.test_name}`);
      continue;
    }

    const sourceContext = await readSourceFileContext(process.cwd(), failure.suite);
    const analysis = await analyzer.analyzeFailure({
      testName: failure.test_name,
      errorMessage: failure.error_message || "",
      suite: failure.suite,
      runId: failure.run_id,
      sourceFilePath: sourceContext?.path,
      sourceFileContent: sourceContext?.content,
      sourceFileTruncated: sourceContext?.truncated,
    });

    const { error: insertError } = await supabase.from("ai_analysis").insert({
      run_id: failure.run_id,
      test_name: failure.test_name,
      error_message: failure.error_message,
      ai_summary: analysis.summary,
      suggested_fix: analysis.suggested_fix,
      severity: analysis.severity,
      classification: analysis.classification,
      confidence: analysis.confidence,
      target_file: analysis.target_file,
      generated_patch: analysis.generated_patch,
    });

    if (insertError) {
      console.error(insertError);
    } else {
      console.log(`AI analysis saved for: ${failure.test_name}`);
    }
  }
}

main();
