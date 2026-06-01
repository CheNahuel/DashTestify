import { createGeminiFailureAnalyzer } from "./gemini-provider";
import { createGroqFailureAnalyzer } from "./groq-provider";
import { createOpenAiFailureAnalyzer } from "./openai-provider";
import { createOpenRouterFailureAnalyzer } from "./openrouter-provider";
import type { AiProviderName, FailureAnalysis, FailureAnalysisInput } from "./types";

type FetchLike = typeof fetch;

type AiProviderOptions = {
  fetchImpl?: FetchLike;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiMaxCompletionTokens?: number;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiMaxOutputTokens?: number;
  groqApiKey?: string;
  groqModel?: string;
  groqMaxOutputTokens?: number;
  openRouterApiKey?: string;
  openRouterModel?: string;
  openRouterMaxOutputTokens?: number;
};

export type FailureAnalyzer = {
  provider: AiProviderName;
  analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis>;
};

function parsePositiveInteger(value: string | undefined | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseAiProviderName(value: string | undefined | null): AiProviderName {
  if (value === "gemini") {
    return "gemini";
  }

  if (value === "groq") {
    return "groq";
  }

  if (value === "openrouter") {
    return "openrouter";
  }

  return "openai";
}

export function createAiProvider(
  providerName: AiProviderName,
  options: AiProviderOptions = {},
): FailureAnalyzer {
  const fetchImpl = options.fetchImpl;

  if (providerName === "gemini") {
    return createGeminiFailureAnalyzer({
      apiKey: options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
      model: options.geminiModel ?? process.env.GEMINI_MODEL,
      maxOutputTokens:
        options.geminiMaxOutputTokens ?? parsePositiveInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS),
      fetchImpl,
    });
  }

  if (providerName === "groq") {
    return createGroqFailureAnalyzer({
      apiKey: options.groqApiKey ?? process.env.GROQ_API_KEY ?? "",
      model: options.groqModel ?? process.env.GROQ_MODEL,
      maxOutputTokens:
        options.groqMaxOutputTokens ?? parsePositiveInteger(process.env.GROQ_MAX_OUTPUT_TOKENS),
      fetchImpl,
    });
  }

  if (providerName === "openrouter") {
    return createOpenRouterFailureAnalyzer({
      apiKey: options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY ?? "",
      model: options.openRouterModel ?? process.env.OPENROUTER_MODEL,
      maxOutputTokens:
        options.openRouterMaxOutputTokens ??
        parsePositiveInteger(process.env.OPENROUTER_MAX_OUTPUT_TOKENS),
      fetchImpl,
    });
  }

  return createOpenAiFailureAnalyzer({
    apiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "",
    model: options.openAiModel ?? process.env.OPENAI_MODEL,
    maxCompletionTokens:
      options.openAiMaxCompletionTokens ??
      parsePositiveInteger(process.env.OPENAI_MAX_COMPLETION_TOKENS),
    fetchImpl,
  });
}
