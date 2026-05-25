export type AiProviderName = "openai" | "gemini";

export type FailureAnalysisSeverity = "low" | "medium" | "high";

export type FailureAnalysisClassification =
  | "test_issue"
  | "app_issue"
  | "infra_issue"
  | "flaky_test"
  | "unknown";

export type FailureRecord = {
  run_id: string | number;
  test_name: string;
  error_message: string | null;
  suite?: string | null;
};

export type FailureAnalysisInput = {
  testName: string;
  errorMessage: string;
  suite?: string | null;
  runId?: string | number;
};

export type FailureAnalysis = {
  summary: string;
  severity: FailureAnalysisSeverity;
  classification: FailureAnalysisClassification;
  confidence: number;
  target_file: string;
  suggested_fix: string;
  generated_patch: string;
};

export type FailureAnalysisApiPayload = Partial<FailureAnalysis> & {
  summary?: unknown;
  severity?: unknown;
  classification?: unknown;
  confidence?: unknown;
  target_file?: unknown;
  suggested_fix?: unknown;
  generated_patch?: unknown;
};

