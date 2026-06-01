import {
  buildFailureAnalysisPrompt,
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

type GroqGenerateResponse = {
  error?: {
    message?: string;
    code?: string;
  };
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  results?: Array<{
    output?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractGroqText(payload: GroqGenerateResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim();

  if (outputText) {
    return outputText;
  }

  const result = payload.results?.[0];
  const fallbackText = result?.output
    ?.map((item) => item.text ?? "")
    .join("")
    .trim();

  return fallbackText || "";
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1000 : null;
}

async function fetchWithGroqRetry(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const firstResponse = await fetchImpl(url, init);

  if (firstResponse.status !== 429) {
    return firstResponse;
  }

  const retryAfterMs = parseRetryAfter(firstResponse.headers.get("retry-after")) ?? 22000;

  await new Promise((resolve) => setTimeout(resolve, retryAfterMs));

  return fetchImpl(url, init);
}

export function createGroqFailureAnalyzer(options: GroqFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const model = options.model?.trim() || "openai/gpt-oss-20b";
  const maxOutputTokens = options.maxOutputTokens ?? 1024;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required to use the Groq provider.");
  }

  return {
    provider: "groq" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      const requestBody = JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: FAILURE_ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildFailureAnalysisPrompt(failure),
          },
        ],
        temperature: 0.2,
        max_output_tokens: maxOutputTokens,
      });

      const response = await fetchWithGroqRetry(
        fetchImpl,
        "https://api.groq.com/openai/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: requestBody,
        },
      );

      const responseText = await response.text();
      let payload: GroqGenerateResponse = {};

      try {
        payload = JSON.parse(responseText) as GroqGenerateResponse;
      } catch {
        throw new Error(`Groq returned invalid JSON: ${responseText}`);
      }

      if (!response.ok) {
        const errorMessage =
          payload.error?.message || `Groq request failed with status ${response.status}`;

        if (response.status === 429) {
          throw new Error(
            `${errorMessage}. Rate limit reached for Groq in the current minute. Try again after a short wait or use a smaller model with GROQ_MODEL.`,
          );
        }

        throw new Error(errorMessage);
      }

      const content = extractGroqText(payload);

      if (!content) {
        throw new Error("Groq returned an empty response.");
      }

      return parseFailureAnalysisResponse(content);
    },
  };
}
