import { createGeminiFailureAnalyzer } from "./gemini-provider";
import { createOpenAiFailureAnalyzer } from "./openai-provider";
import type { AiProviderName, FailureAnalysis, FailureAnalysisInput } from "./types";

type FetchLike = typeof fetch;

type AiProviderOptions = {
  fetchImpl?: FetchLike;
  openAiApiKey?: string;
  openAiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

export type FailureAnalyzer = {
  provider: AiProviderName;
  analyzeFailure(failure: FailureAnalysisInput): Promise<FailureAnalysis>;
};

export function parseAiProviderName(value: string | undefined | null): AiProviderName {
  if (value === "gemini") {
    return "gemini";
  }

  return "openai";
}

export function createAiProvider(providerName: AiProviderName, options: AiProviderOptions = {}): FailureAnalyzer {
  const fetchImpl = options.fetchImpl;

  if (providerName === "gemini") {
    return createGeminiFailureAnalyzer({
      apiKey: options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
      model: options.geminiModel ?? process.env.GEMINI_MODEL,
      fetchImpl,
    });
  }

  return createOpenAiFailureAnalyzer({
    apiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "",
    model: options.openAiModel ?? process.env.OPENAI_MODEL,
    fetchImpl,
  });
}
