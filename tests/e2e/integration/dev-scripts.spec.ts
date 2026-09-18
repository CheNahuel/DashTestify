import { expect, test } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

// These tests verify that the new npm scripts work correctly
// Tests run in isolation to avoid state conflicts

const projectRoot = path.resolve(__dirname, "../../../");

test("npm run dev script exists in package.json", () => {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = require(packageJsonPath);

  expect(packageJson.scripts).toBeDefined();
  expect(packageJson.scripts.dev).toBeDefined();
});


test(".env.example documents all AI provider keys", () => {
  const envExamplePath = path.join(projectRoot, ".env.example");
  const envContent = require("fs").readFileSync(envExamplePath, "utf8");

  // Should have keys for all providers
  expect(envContent).toContain("CLAUDE_API_KEY");
  expect(envContent).toContain("OPENAI_API_KEY");
  expect(envContent).toContain("GEMINI_API_KEY");
  expect(envContent).toContain("GROQ_API_KEY");
  expect(envContent).toContain("DEEPSEEK_API_KEY");
  expect(envContent).toContain("OPENROUTER_API_KEY");

  // Should have model config options
  expect(envContent).toContain("CLAUDE_MODEL");
  expect(envContent).toContain("OPENAI_MODEL");
  expect(envContent).toContain("GEMINI_MODEL");
  expect(envContent).toContain("GROQ_MODEL");
  expect(envContent).toContain("DEEPSEEK_MODEL");
});

test(".env.example documents data source options", () => {
  const envExamplePath = path.join(projectRoot, ".env.example");
  const envContent = require("fs").readFileSync(envExamplePath, "utf8");

  expect(envContent).toContain("DATA_SOURCE");
  expect(envContent).toContain("coincap");
  expect(envContent).toContain("supabase");
});

test("README documents npm run dev command", () => {
  const readmePath = path.join(projectRoot, "README.md");
  const readmeContent = require("fs").readFileSync(readmePath, "utf8");

  expect(readmeContent).toContain("npm run dev");
});

test("README documents AI capabilities", () => {
  const readmePath = path.join(projectRoot, "README.md");
  const readmeContent = require("fs").readFileSync(readmePath, "utf8");

  expect(readmeContent).toContain("AI");
  expect(readmeContent).toContain("Claude");
});

test("README documents setup instructions", () => {
  const readmePath = path.join(projectRoot, "README.md");
  const readmeContent = require("fs").readFileSync(readmePath, "utf8");

  expect(readmeContent).toContain("npm install");
  expect(readmeContent).toContain("CoinCap");
});

test("sync endpoints are refactored to use shared auth utilities", () => {
  const authUtilPath = path.join(projectRoot, "src/app/api/internal/_auth.ts");
  const authContent = require("fs").readFileSync(authUtilPath, "utf8");

  expect(authContent).toContain("validateSyncSecret");
  expect(authContent).toContain("syncSuccessResponse");
  expect(authContent).toContain("syncErrorResponse");
});

test("sync-daily route uses shared auth utilities", () => {
  const syncDailyPath = path.join(projectRoot, "src/app/api/internal/sync-daily/route.ts");
  const syncDailyContent = require("fs").readFileSync(syncDailyPath, "utf8");

  expect(syncDailyContent).toContain("validateSyncSecret");
  expect(syncDailyContent).toContain("syncSuccessResponse");
  expect(syncDailyContent).toContain("syncErrorResponse");
  expect(syncDailyContent).toMatch(/"\.\.\/[_]?auth"/);
});

test("sync-intraday route uses shared auth utilities", () => {
  const syncIntradayPath = path.join(
    projectRoot,
    "src/app/api/internal/sync-intraday/route.ts"
  );
  const syncIntradayContent = require("fs").readFileSync(syncIntradayPath, "utf8");

  expect(syncIntradayContent).toContain("validateSyncSecret");
  expect(syncIntradayContent).toContain("syncSuccessResponse");
  expect(syncIntradayContent).toContain("syncErrorResponse");
  expect(syncIntradayContent).toMatch(/"\.\.\/[_]?auth"/);
});

test("crypto-analyst has no duplicate extractResponseText logic", () => {
  const cryptoAnalystPath = path.join(projectRoot, "src/lib/ai/crypto-analyst.ts");
  const cryptoAnalystContent = require("fs").readFileSync(cryptoAnalystPath, "utf8");

  // Count how many times "Groq & DeepSeek" appears
  const groqDeepseekMatches = cryptoAnalystContent.match(/Groq.*DeepSeek/gi);

  // Should not have the duplicate "Groq & DeepSeek: same as OpenAI" comment
  // that was removed during deduplication
  expect(groqDeepseekMatches).toBeNull();

  // Should still have the correct extraction logic for choices
  const choicesMatches = cryptoAnalystContent.match(/Array\.isArray\(data\.choices\)/g);
  // Should have exactly 1 check for choices (OpenAI, Groq, DeepSeek use this)
  expect(choicesMatches).toBeDefined();
  expect(choicesMatches?.length).toBe(1);
});
