import {
  buildFailureAnalysisPrompt,
  FAILURE_ANALYSIS_JSON_SCHEMA,
  FAILURE_ANALYSIS_SYSTEM_PROMPT,
  parseFailureAnalysisResponse,
} from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type GroqFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  fetchImpl?: FetchLike;
};

type GroqChatCompletionResponse = {
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

function extractGroqText(payload: GroqChatCompletionResponse) {
  const completion = payload.choices?.[0]?.message;

  if (completion?.refusal) {
    return "";
  }

  return completion?.content?.trim() || "";
}

export function createGroqFailureAnalyzer(options: GroqFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "llama-3.3-70b-versatile";
  const maxOutputTokens = options.maxOutputTokens ?? 1024;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required to use the Groq provider.");
  }

  return {
    provider: "groq" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: maxOutputTokens,
          messages: [
            {
              role: "system",
              content: `${FAILURE_ANALYSIS_SYSTEM_PROMPT}

You must return ONLY valid JSON.
Do not include markdown fences.
Do not include explanations outside the JSON.
The response must match this JSON schema:

${JSON.stringify(FAILURE_ANALYSIS_JSON_SCHEMA, null, 2)}`,
            },
            {
              role: "user",
              content: buildFailureAnalysisPrompt(failure),
            },
          ],
        }),
      });

      const payload = (await response.json()) as GroqChatCompletionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message || `Groq request failed with status ${response.status}`,
        );
      }

      const content = extractGroqText(payload);

      if (!content) {
        throw new Error("Groq returned an empty response.");
      }

      return parseFailureAnalysisResponse(content);
    },
  };
}
