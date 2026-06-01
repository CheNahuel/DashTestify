import {
  buildFailureAnalysisPrompt,
  FAILURE_ANALYSIS_JSON_SCHEMA,
  FAILURE_ANALYSIS_SYSTEM_PROMPT,
  parseFailureAnalysisResponse,
} from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type GeminiFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  fetchImpl?: FetchLike;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
  text?: string;
};

function extractGeminiText(payload: GeminiGenerateContentResponse) {
  const candidateText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  return candidateText || payload.text || "";
}

export function createGeminiFailureAnalyzer(options: GeminiFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "gemini-2.5-flash-lite";
  const maxOutputTokens = options.maxOutputTokens ?? 1024;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to use the Gemini provider.");
  }

  return {
    provider: "gemini" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: FAILURE_ANALYSIS_SYSTEM_PROMPT }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildFailureAnalysisPrompt(failure) }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens,
              responseMimeType: "application/json",
              responseJsonSchema: FAILURE_ANALYSIS_JSON_SCHEMA,
            },
          }),
        },
      );

      const payload = (await response.json()) as GeminiGenerateContentResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini request failed with status ${response.status}`);
      }

      const content = extractGeminiText(payload);

      if (!content) {
        throw new Error("Gemini returned an empty response.");
      }

      return parseFailureAnalysisResponse(content);
    },
  };
}
