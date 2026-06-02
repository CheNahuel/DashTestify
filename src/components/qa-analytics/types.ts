export type AiProvider = "openai" | "gemini" | "deepseek" | "openrouter";

export type LatestLocalFailure = {
  test_name: string | null;
  failures: number;
  run_id: string | number;
  suite: string | null;
  error_message: string | null;
};

export type LocalAiAnalysis = {
  id: string;
  run_id?: string | number | null;
  test_name: string;
  error_message?: string | null;
  created_at?: string | null;
  ai_summary: string;
  suggested_fix: string;
  severity: string;
  classification: string;
  confidence: number;
  target_file: string | null;
  generated_patch: string | null;
};

export type LocalTestRun = {
  id: string;
  branch: string;
  commit_sha: string | null;
  created_at: string;
  passed: number;
  failed: number;
  total_tests: number;
};
