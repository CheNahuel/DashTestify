import "dotenv/config";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

const resultsPath = "test-results/results.json";

if (!fs.existsSync(resultsPath)) {
  console.log("No results.json found. Skipping upload.");
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));

async function main() {
  const total = results.stats.expected;
  const failed = results.stats.unexpected;
  const passed = total - failed;

  const { data: run, error } = await supabase
    .from("test_runs")
    .insert({
      commit_sha: process.env.GITHUB_SHA,
      branch: process.env.GITHUB_REF_NAME,
      total_tests: total,
      passed,
      failed,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating test run:", error);
    process.exit(1);
  }

  for (const suite of results.suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        await supabase.from("test_results").insert({
          run_id: run.id,
          test_name: test.title,
          suite: suite.title,
          status: test.results?.[0]?.status,
          duration_ms: test.results?.[0]?.duration,
          retry: test.results?.[0]?.retry ?? 0,
          error_message: test.results?.[0]?.error?.message || null,
        });
      }
    }
  }

  console.log(`Uploaded run ${run.id}`);
  console.log(`Processed ${total} tests`);
  console.log("Looking for results at:", resultsPath);
  console.log("Exists:", fs.existsSync(resultsPath));
}

main();
