import "dotenv/config";

import fs from "fs";

import simpleGit from "simple-git";

import { createClient } from "@supabase/supabase-js";

const git = simpleGit();

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

  for (const analysis of analyses || []) {
    if (!analysis.target_file || !analysis.generated_patch) {
      console.log(`Skipping ${analysis.test_name} - missing patch info`);

      continue;
    }

    const branchName = `ai-fix/${analysis.id}`;

    console.log(`Creating branch: ${branchName}`);

    await git.checkoutLocalBranch(branchName);

    const filePath = analysis.target_file;

    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);

      continue;
    }

    const originalContent = fs.readFileSync(filePath, "utf-8");

    // VERY naive patch replacement for MVP
    const updatedContent = originalContent.replace(/search-input-FAILING/g, "search-input");

    fs.writeFileSync(filePath, updatedContent);

    console.log(`Updated file: ${filePath}`);

    await git.add(filePath);

    await git.commit(`AI-generated fix for ${analysis.test_name}`);

    console.log(`Committed AI fix for ${analysis.test_name}`);
  }
}

main();
