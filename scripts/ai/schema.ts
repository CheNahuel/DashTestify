import type { FailureAnalysis, FailureAnalysisApiPayload, FailureAnalysisInput } from "./types";

export const FAILURE_ANALYSIS_SYSTEM_PROMPT =
  "You are an expert QA automation engineer that diagnoses Playwright failures and proposes the smallest safe fix.";

export const FAILURE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "Short explanation of the root cause.",
    },
    severity: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "How urgent the issue is.",
    },
    classification: {
      type: "string",
      enum: ["test_issue", "app_issue", "infra_issue", "flaky_test", "unknown"],
      description: "What kind of failure this appears to be.",
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Confidence score from 0 to 100.",
    },
    target_file: {
      type: "string",
      description: "Repository-relative file path that should be updated.",
    },
    suggested_fix: {
      type: "string",
      description: "Plain-language description of the fix.",
    },
    generated_patch: {
      type: "string",
      description:
        "A unified diff that can be applied with git apply. Keep it minimal and scoped to a single file.",
    },
  },
  required: [
    "summary",
    "severity",
    "classification",
    "confidence",
    "target_file",
    "suggested_fix",
    "generated_patch",
  ],
} as const;

export function buildFailureAnalysisPrompt(failure: FailureAnalysisInput) {
  const sourceContext = failure.sourceFilePath
    ? [
        "",
        `Current source file: ${failure.sourceFilePath}`,
        failure.sourceFileTruncated
          ? "Source note: content was truncated; keep the patch within the visible content."
          : "",
        "Current source content:",
        "```",
        failure.sourceFileContent || "",
        "```",
      ].filter(Boolean)
    : [];

  return [
    "Analyze this Playwright test failure and return only JSON that matches the provided schema.",
    "Return exactly one primary actionable fix. Do not provide alternate fixes or competing explanations in the JSON fields.",
    "IMPORTANT: Return ONLY the JSON object with no additional text, explanations, or markdown formatting.",
    "",
    `Test name: ${failure.testName}`,
    `Run ID: ${failure.runId ?? "unknown"}`,
    `Suite: ${failure.suite ?? "unknown"}`,
    ...sourceContext,
    "",
    "Error:",
    failure.errorMessage,
    "",
    "Guidelines:",
    "- Use classification=test_issue when the selector, assertion, or test setup is the likely problem.",
    "- Use classification=app_issue when the application behavior changed and the test is correct.",
    "- Use classification=infra_issue for environment or dependency failures.",
    "- Use classification=flaky_test when the failure is intermittent and not clearly a product bug.",
    "- confidence must be an integer from 0 to 100.",
    "- If the fix is not clearly actionable, keep the answer conservative and lower the confidence instead of inventing a stronger fix.",
    "- target_file should be a repository-relative path, preferably inside tests/ for test fixes.",
    "- generated_patch must be a unified diff for exactly one file and should apply cleanly with git apply.",
    "- If current source content is provided, base generated_patch only on those exact lines.",
    "- Do not invent selectors, page-object fields, or helper names that are not present in the current source content.",
    "- Use the Current source file path as target_file unless the error clearly belongs to a different file.",
  ].join("\n");
}

function stripMarkdownFences(raw: string) {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function toSeverity(value: unknown): FailureAnalysis["severity"] {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return "medium";
}

function toClassification(value: unknown): FailureAnalysis["classification"] {
  if (
    value === "test_issue" ||
    value === "app_issue" ||
    value === "infra_issue" ||
    value === "flaky_test" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function toConfidence(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeFailureAnalysis(
  payload: FailureAnalysisApiPayload | null | undefined,
  fallbackSummary = "No summary returned by the provider.",
): FailureAnalysis {
  return {
    summary: toStringValue(payload?.summary, fallbackSummary),
    severity: toSeverity(payload?.severity),
    classification: toClassification(payload?.classification),
    confidence: toConfidence(payload?.confidence),
    target_file: toStringValue(payload?.target_file),
    suggested_fix: toStringValue(payload?.suggested_fix, "Unable to generate a suggested fix."),
    generated_patch: toStringValue(payload?.generated_patch),
  };
}

export function parseFailureAnalysisResponse(rawContent: string): FailureAnalysis {
  const cleaned = stripMarkdownFences(rawContent);

  try {
    let parsed = JSON.parse(cleaned) as unknown;

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed) as unknown;
    }

    return normalizeFailureAnalysis(parsed as FailureAnalysisApiPayload, cleaned);
  } catch {
    return normalizeFailureAnalysis({ summary: cleaned, suggested_fix: cleaned }, cleaned);
  }
}
