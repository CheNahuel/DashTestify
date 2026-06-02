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
  content?: Array<{
    type: string;
    text?: string;
  }>;
};

function extractClaudeText(payload: ClaudeChatCompletionResponse): string {
  let rawText = "";

  if (Array.isArray(payload.content)) {
    const textBlock = payload.content.find((block) => block.type === "text");
    if (textBlock?.text) {
      rawText = textBlock.text.trim();
    }
  }

  if (!rawText && typeof payload.completion === "string" && payload.completion.trim().length > 0) {
    rawText = payload.completion.trim();
  }

  if (!rawText) {
    const outputText = payload.response?.output_text;
    if (typeof outputText === "string" && outputText.trim().length > 0) {
      rawText = outputText.trim();
    }
  }

  if (!rawText) {
    return "";
  }

  // Extract JSON if it's wrapped in markdown fences or other text
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return rawText;
}

export function createClaudeFailureAnalyzer(options: ClaudeFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "claude-haiku-4-5";
  const maxCompletionTokens = options.maxCompletionTokens ?? 1024;

  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY is required to use the Claude provider.");
  }

  return {
    provider: "claude" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxCompletionTokens,
          temperature: 0.2,
          system: FAILURE_ANALYSIS_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildFailureAnalysisPrompt(failure),
            },
          ],
        }),
      });

      let payload: ClaudeChatCompletionResponse;
      try {
        payload = (await response.json()) as ClaudeChatCompletionResponse;
      } catch (parseError) {
        throw new Error(`Claude API returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (!response.ok) {
        const errorMsg = typeof payload.error?.message === "string"
          ? payload.error.message
          : `Claude request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      const content = extractClaudeText(payload);

      if (!content) {
        throw new Error("Claude returned an empty completion.");
      }

      return parseFailureAnalysisResponse(content);
    },
  };
}
