import {
  buildFailureAnalysisPrompt,
  FAILURE_ANALYSIS_JSON_SCHEMA,
  FAILURE_ANALYSIS_SYSTEM_PROMPT,
  parseFailureAnalysisResponse,
} from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type DeepseekFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  maxCompletionTokens?: number;
  fetchImpl?: FetchLike;
};

type DeepseekChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createDeepseekFailureAnalyzer(options: DeepseekFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "deepseek-chat";
  const maxCompletionTokens = options.maxCompletionTokens ?? 1024;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required to use the Deepseek provider.");
  }

  return {
    provider: "deepseek" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_completion_tokens: maxCompletionTokens,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "playwright_failure_analysis",
              strict: true,
              schema: FAILURE_ANALYSIS_JSON_SCHEMA,
            },
          },
          messages: [
            {
              role: "system",
              content: FAILURE_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: buildFailureAnalysisPrompt(failure),
            },
          ],
        }),
      });

      const payload = (await response.json()) as DeepseekChatCompletionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message || `Deepseek request failed with status ${response.status}`,
        );
      }

      const completion = payload.choices?.[0]?.message;

      if (!completion) {
        throw new Error("Deepseek returned an empty completion.");
      }

      if (completion.refusal) {
        throw new Error(`Deepseek refused to analyze the failure: ${completion.refusal}`);
      }

      return parseFailureAnalysisResponse(completion.content ?? "{}");
    },
  };
}
