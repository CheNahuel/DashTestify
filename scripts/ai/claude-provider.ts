import {
  buildFailureAnalysisPrompt,
  FAILURE_ANALYSIS_JSON_SCHEMA,
  FAILURE_ANALYSIS_SYSTEM_PROMPT,
  parseFailureAnalysisResponse,
} from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type ClaudeFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  maxCompletionTokens?: number;
  fetchImpl?: FetchLike;
};

type ClaudeChatCompletionResponse = {
  completion?: string;
  response?: {
    output_text?: string;
  };
  error?: {
    message?: string;
  };
};

function extractClaudeText(payload: ClaudeChatCompletionResponse) {
  if (typeof payload.completion === "string" && payload.completion.trim().length > 0) {
    return payload.completion.trim();
  }

  const outputText = payload.response?.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText.trim();
  }

  return "";
}

export function createClaudeFailureAnalyzer(options: ClaudeFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "claude-3.5-mini";
  const maxCompletionTokens = options.maxCompletionTokens ?? 1024;

  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY is required to use the Claude provider.");
  }

  return {
    provider: "claude" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl("https://api.anthropic.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: maxCompletionTokens,
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

      const payload = (await response.json()) as ClaudeChatCompletionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message || `Claude request failed with status ${response.status}`,
        );
      }

      const content = extractClaudeText(payload);

      if (!content) {
        throw new Error("Claude returned an empty completion.");
      }

      return parseFailureAnalysisResponse(content);
    },
  };
}
