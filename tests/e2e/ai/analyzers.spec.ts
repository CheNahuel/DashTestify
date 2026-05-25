import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

import { expect, test } from "@playwright/test";

import {
  applyGeneratedPatch,
  checkoutBranchFromBase,
  buildFailureAnalysisPrompt,
  createGeminiFailureAnalyzer,
  createOpenAiFailureAnalyzer,
  normalizeFailureAnalysis,
  parseFailureAnalysisResponse,
} from "../../../scripts/ai";
import { POST as postAnalyticsAi } from "../../../src/app/api/analytics/ai/route";

test("builds a prompt that includes the failure context and patch rules", async () => {
  const prompt = buildFailureAnalysisPrompt({
    testName: "dashboard search keeps failing",
    errorMessage: "Locator not found",
    suite: "dashboard/search.spec.ts",
    runId: 42,
  });

  expect(prompt).toContain("dashboard search keeps failing");
  expect(prompt).toContain("Locator not found");
  expect(prompt).toContain("generated_patch must be a unified diff");
});

test("normalizes malformed analysis payloads into safe defaults", async () => {
  const malformedPayload: Record<string, unknown> = {
    summary: 123,
    severity: "urgent",
    classification: "banana",
    confidence: 133,
    target_file: 99,
    suggested_fix: "",
    generated_patch: null,
  };

  const analysis = normalizeFailureAnalysis(malformedPayload);

  expect(analysis.summary).toBe("No summary returned by the provider.");
  expect(analysis.severity).toBe("medium");
  expect(analysis.classification).toBe("unknown");
  expect(analysis.confidence).toBe(100);
  expect(analysis.target_file).toBe("");
  expect(analysis.suggested_fix).toBe("Unable to generate a suggested fix.");
  expect(analysis.generated_patch).toBe("");
});

test("parses fenced JSON responses", async () => {
  const analysis = parseFailureAnalysisResponse(
    "```json\n{\"summary\":\"ok\",\"severity\":\"low\",\"classification\":\"test_issue\",\"confidence\":87,\"target_file\":\"tests/a.spec.ts\",\"suggested_fix\":\"fix\",\"generated_patch\":\"diff --git a/tests/a.spec.ts b/tests/a.spec.ts\\n--- a/tests/a.spec.ts\\n+++ b/tests/a.spec.ts\\n@@ -1 +1 @@\\n-old\\n+new\"}\n```",
  );

  expect(analysis.summary).toBe("ok");
  expect(analysis.severity).toBe("low");
  expect(analysis.classification).toBe("test_issue");
  expect(analysis.confidence).toBe(87);
  expect(analysis.target_file).toBe("tests/a.spec.ts");
});

test("openai provider sends the shared schema and parses the response", async () => {
  let requestBody: Record<string, unknown> | undefined;

  const fetchImpl = async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"summary":"broken selector","severity":"high","classification":"test_issue","confidence":92,"target_file":"tests/e2e/dashboard/search.spec.ts","suggested_fix":"update selector","generated_patch":"diff --git a/tests/e2e/dashboard/search.spec.ts b/tests/e2e/dashboard/search.spec.ts\\n--- a/tests/e2e/dashboard/search.spec.ts\\n+++ b/tests/e2e/dashboard/search.spec.ts\\n@@ -1 +1 @@\\n-old\\n+new"}',
            },
          },
        ],
      }),
    } as Response;
  };

  const analyzer = createOpenAiFailureAnalyzer({
    apiKey: "test-key",
    model: "gpt-test",
    fetchImpl,
  });

  const analysis = await analyzer.analyzeFailure({
    testName: "search rejects value",
    errorMessage: "Timeout waiting for locator",
  });

  expect(requestBody?.model).toBe("gpt-test");
  expect(requestBody?.response_format).toBeTruthy();
  expect(analysis.classification).toBe("test_issue");
  expect(analysis.target_file).toBe("tests/e2e/dashboard/search.spec.ts");
});

test("gemini provider sends the shared schema and parses the response", async () => {
  let requestBody: Record<string, unknown> | undefined;
  let requestUrl = "";

  const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(url);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text:
                    '{"summary":"infra issue","severity":"medium","classification":"infra_issue","confidence":80,"target_file":"scripts/analyze-failures.ts","suggested_fix":"retry later","generated_patch":"diff --git a/scripts/analyze-failures.ts b/scripts/analyze-failures.ts\\n--- a/scripts/analyze-failures.ts\\n+++ b/scripts/analyze-failures.ts\\n@@ -1 +1 @@\\n-old\\n+new"}',
                },
              ],
            },
          },
        ],
      }),
    } as Response;
  };

  const analyzer = createGeminiFailureAnalyzer({
    apiKey: "test-key",
    model: "gemini-test",
    fetchImpl,
  });

  const analysis = await analyzer.analyzeFailure({
    testName: "api responds slowly",
    errorMessage: "FetchError",
  });

  expect(requestUrl).toContain("gemini-test:generateContent");
  expect(requestBody?.generationConfig).toBeTruthy();
  expect(analysis.classification).toBe("infra_issue");
  expect(analysis.target_file).toBe("scripts/analyze-failures.ts");
});

test("applyGeneratedPatch applies a unified diff to the working tree", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-patch-repo-"));
  const filePath = path.join(repoRoot, "sample.ts");

  fs.writeFileSync(filePath, 'export const status = "old";\n', "utf8");
  execFileSync("git", ["init"], { cwd: repoRoot });

  const patch = [
    "diff --git a/sample.ts b/sample.ts",
    "--- a/sample.ts",
    "+++ b/sample.ts",
    "@@ -1 +1 @@",
    '-export const status = "old";',
    '+export const status = "new";',
    "",
  ].join("\n");

  await applyGeneratedPatch(repoRoot, patch);

  const updated = fs.readFileSync(filePath, "utf8");

  expect(updated).toBe('export const status = "new";\n');
});

test("applyGeneratedPatch resolves shortened paths and survives corrupt hunk headers", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-patch-repo-short-"));
  const filePath = path.join(repoRoot, "tests/e2e/dashboard/interactions.spec.ts");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'await expect(dashboardPage.searchInput).toHaveValue("FAILURE");\n', "utf8");
  execFileSync("git", ["init"], { cwd: repoRoot });

  const patch = [
    "diff --git a/e2e/dashboard/interactions.spec.ts b/e2e/dashboard/interactions.spec.ts",
    "--- a/e2e/dashboard/interactions.spec.ts",
    "+++ b/e2e/dashboard/interactions.spec.ts",
    "@@ -X,1 +X,1 @@",
    '-await expect(dashboardPage.searchInput).toHaveValue("FAILURE");',
    '+await expect(dashboardPage.searchInput).toHaveValue("");',
    "",
  ].join("\n");

  await applyGeneratedPatch(repoRoot, patch);

  const updated = fs.readFileSync(filePath, "utf8");

  expect(updated).toBe('await expect(dashboardPage.searchInput).toHaveValue("");\n');
});

test("applyGeneratedPatch strips ansi escapes before applying the patch", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-patch-repo-ansi-"));
  const filePath = path.join(repoRoot, "sample.ts");

  fs.writeFileSync(filePath, 'await expect(dashboardPage.searchInput).toHaveValue("FAILURE");\n', "utf8");
  execFileSync("git", ["init"], { cwd: repoRoot });

  const patch = [
    "diff --git a/sample.ts b/sample.ts",
    "--- a/sample.ts",
    "+++ b/sample.ts",
    "@@ -1 +1 @@",
    "\u001b[31m-await expect(dashboardPage.searchInput).toHaveValue(\"FAILURE\");\u001b[0m",
    "\u001b[32m+await expect(dashboardPage.searchInput).toHaveValue(\"\");\u001b[0m",
    "",
  ].join("\n");

  await applyGeneratedPatch(repoRoot, patch);

  const updated = fs.readFileSync(filePath, "utf8");

  expect(updated).toBe('await expect(dashboardPage.searchInput).toHaveValue("");\n');
});

test("applyGeneratedPatch falls back when hunk context does not match exactly", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-patch-repo-relaxed-"));
  const filePath = path.join(repoRoot, "sample.ts");

  fs.writeFileSync(
    filePath,
    [
      'await dashboardPage.resetButton.click();',
      'await expect(dashboardPage.searchInput).toHaveValue("FAILURE");',
      'await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");',
      "",
    ].join("\n"),
    "utf8",
  );
  execFileSync("git", ["init"], { cwd: repoRoot });

  const patch = [
    "diff --git a/sample.ts b/sample.ts",
    "--- a/sample.ts",
    "+++ b/sample.ts",
    "@@ -1,3 +1,4 @@",
    "-await dashboardPage.someOtherStep();",
    ' await dashboardPage.resetButton.click();',
    '+await page.getByTestId("search-input").fill("FAILURE");',
    '-await expect(dashboardPage.searchInput).toHaveValue("FAILURE");',
    '+await expect(dashboardPage.searchInput).toHaveValue("");',
    ' await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");',
    "",
  ].join("\n");

  await applyGeneratedPatch(repoRoot, patch);

  const updated = fs.readFileSync(filePath, "utf8");

  expect(updated).toContain('await page.getByTestId("search-input").fill("FAILURE");');
  expect(updated).toContain('await expect(dashboardPage.searchInput).toHaveValue("");');
  expect(updated).toContain('await expect(dashboardPage.sortSelect).toHaveValue("market-cap-desc");');
});

test("checkoutBranchFromBase creates the fix branch from the source commit", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-branch-repo-"));
  const filePath = path.join(repoRoot, "sample.ts");

  fs.writeFileSync(filePath, 'export const status = "base";\n', "utf8");
  execFileSync("git", ["init"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "codex@example.com"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Codex"], { cwd: repoRoot });
  execFileSync("git", ["add", "sample.ts"], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "base"], { cwd: repoRoot });

  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

  fs.writeFileSync(filePath, 'export const status = "head";\n', "utf8");
  execFileSync("git", ["add", "sample.ts"], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "head"], { cwd: repoRoot });

  await checkoutBranchFromBase(repoRoot, "ai-fix/123", baseCommit);

  const branchName = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const updated = fs.readFileSync(filePath, "utf8");

  expect(branchName).toBe("ai-fix/123");
  expect(updated).toBe('export const status = "base";\n');
});

test("checkoutBranchFromBase can create the fix branch from a source branch ref", async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-branch-ref-repo-"));
  const filePath = path.join(repoRoot, "sample.ts");

  fs.writeFileSync(filePath, 'export const status = "base";\n', "utf8");
  execFileSync("git", ["init"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "codex@example.com"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Codex"], { cwd: repoRoot });
  execFileSync("git", ["add", "sample.ts"], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "base"], { cwd: repoRoot });
  execFileSync("git", ["branch", "feature/source"], { cwd: repoRoot });

  fs.writeFileSync(filePath, 'export const status = "head";\n', "utf8");
  execFileSync("git", ["add", "sample.ts"], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "head"], { cwd: repoRoot });

  await checkoutBranchFromBase(repoRoot, "ai-fix/branch-ref", "feature/source");

  const branchName = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const updated = fs.readFileSync(filePath, "utf8");

  expect(branchName).toBe("ai-fix/branch-ref");
  expect(updated).toBe('export const status = "base";\n');
});

test("analytics ai route returns a clean error when supabase env is missing", async () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;

    const response = await postAnalyticsAi(
      new Request("http://localhost/api/analytics/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "apply",
          analysisId: "analysis-1",
        }),
      }),
    );

    expect(response.status).toBe(500);

    const payload = (await response.json()) as { error?: string };

    expect(payload.error).toContain("SUPABASE_URL and SUPABASE_KEY are required");
  } finally {
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_KEY = originalSupabaseKey;
  }
});
