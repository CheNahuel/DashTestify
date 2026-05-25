import { buildFailureAnalysisPrompt, FAILURE_ANALYSIS_JSON_SCHEMA, FAILURE_ANALYSIS_SYSTEM_PROMPT, parseFailureAnalysisResponse } from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type OpenAiFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: FetchLike;
};

type OpenAiChatCompletionResponse = {
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

export function createOpenAiFailureAnalyzer(options: OpenAiFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use the OpenAI provider.");
  }

  return {
    provider: "openai" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
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

      const payload = (await response.json()) as OpenAiChatCompletionResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}`);
      }

      const completion = payload.choices?.[0]?.message;

      if (!completion) {
        throw new Error("OpenAI returned an empty completion.");
      }

      if (completion.refusal) {
        throw new Error(`OpenAI refused to analyze the failure: ${completion.refusal}`);
      }

      return parseFailureAnalysisResponse(completion.content ?? "{}");
    },
  };
}

