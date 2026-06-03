import {
  buildFailureAnalysisPrompt,
  FAILURE_ANALYSIS_JSON_SCHEMA,
  FAILURE_ANALYSIS_SYSTEM_PROMPT,
  parseFailureAnalysisResponse,
} from "./schema";
import type { FailureAnalysis, FailureAnalysisInput, AiProviderName } from "./types";

type FetchLike = typeof fetch;

type OpenRouterFailureAnalyzerOptions = {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  fetchImpl?: FetchLike;
};

type OpenRouterChatCompletionResponse = {
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

type OpenRouterModel = {
  id: string;
  name?: string;
  pricing?: {
    prompt: number;
    completion: number;
  };
  context_length?: number;
  per_minute_limit?: number;
  created?: number;
};

async function selectFreeOpenRouterModel(fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl("https://openrouter.ai/api/v1/models");
  const data = (await response.json()) as { data: OpenRouterModel[] };

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Failed to fetch OpenRouter models");
  }

  const freeModels = data.data.filter(
    (model) =>
      model.id.includes(":free") &&
      (!model.per_minute_limit || model.per_minute_limit > 100),
  );

  if (freeModels.length === 0) {
    throw new Error("No free models available on OpenRouter");
  }

  const selectedModel = freeModels[0];
  console.log(`Selected free OpenRouter model: ${selectedModel.id}`);

  return selectedModel.id;
}

export function createOpenRouterFailureAnalyzer(options: OpenRouterFailureAnalyzerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey.trim();
  const modelOption = options.model?.trim();
  const maxOutputTokens = options.maxOutputTokens ?? 1024;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required to use the OpenRouter provider.");
  }

  let selectedModel: string | null = modelOption || null;

  return {
    provider: "openrouter" as AiProviderName,

    async analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis> {
      if (!selectedModel) {
        selectedModel = await selectFreeOpenRouterModel(fetchImpl);
      }

      const model = selectedModel;
      const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: maxOutputTokens,
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

      const payload = (await response.json()) as OpenRouterChatCompletionResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message || `OpenRouter request failed with status ${response.status}`,
        );
      }

      const completion = payload.choices?.[0]?.message;

      if (!completion) {
        throw new Error("OpenRouter returned an empty completion.");
      }

      if (completion.refusal) {
        throw new Error(`OpenRouter refused to analyze the failure: ${completion.refusal}`);
      }

      return parseFailureAnalysisResponse(completion.content ?? "{}");
    },
  };
}
