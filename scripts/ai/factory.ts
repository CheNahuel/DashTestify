import type { AiProviderName, FailureAnalysis, FailureAnalysisInput } from "./types";
import { createClaudeFailureAnalyzer } from "./claude-provider";
import { createDeepseekFailureAnalyzer } from "./deepseek-provider";
import { createGeminiFailureAnalyzer } from "./gemini-provider";
import { createGroqFailureAnalyzer } from "./groq-provider";
import { createOpenAiFailureAnalyzer } from "./openai-provider";
import { createOpenRouterFailureAnalyzer } from "./openrouter-provider";

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
  deepseekApiKey?: string;
  deepseekModel?: string;
  deepseekMaxCompletionTokens?: number;
  claudeApiKey?: string;
  claudeModel?: string;
  claudeMaxCompletionTokens?: number;
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

const VALID_PROVIDERS = new Set<AiProviderName>(["gemini", "groq", "openrouter", "deepseek", "claude", "openai"]);

export function parseAiProviderName(value: string | undefined | null): AiProviderName {
  if (value && VALID_PROVIDERS.has(value as AiProviderName)) {
    return value as AiProviderName;
  }
  return "openai";
}

type ProviderFactory = (options: AiProviderOptions, fetchImpl?: FetchLike) => FailureAnalyzer;

const PROVIDER_FACTORIES: Record<AiProviderName, ProviderFactory> = {
  gemini: (options, fetchImpl) =>
    createGeminiFailureAnalyzer({
      apiKey: options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "",
      model: options.geminiModel ?? process.env.GEMINI_MODEL,
      maxOutputTokens:
        options.geminiMaxOutputTokens ?? parsePositiveInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS),
      fetchImpl,
    }),
  groq: (options, fetchImpl) =>
    createGroqFailureAnalyzer({
      apiKey: options.groqApiKey ?? process.env.GROQ_API_KEY ?? "",
      model: options.groqModel ?? process.env.GROQ_MODEL,
      maxOutputTokens:
        options.groqMaxOutputTokens ?? parsePositiveInteger(process.env.GROQ_MAX_OUTPUT_TOKENS),
      fetchImpl,
    }),
  openrouter: (options, fetchImpl) =>
    createOpenRouterFailureAnalyzer({
      apiKey: options.openRouterApiKey ?? process.env.OPENROUTER_API_KEY ?? "",
      model: options.openRouterModel ?? process.env.OPENROUTER_MODEL,
      maxOutputTokens:
        options.openRouterMaxOutputTokens ??
        parsePositiveInteger(process.env.OPENROUTER_MAX_OUTPUT_TOKENS),
      fetchImpl,
    }),
  deepseek: (options, fetchImpl) =>
    createDeepseekFailureAnalyzer({
      apiKey: options.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? "",
      model: options.deepseekModel ?? process.env.DEEPSEEK_MODEL,
      maxCompletionTokens:
        options.deepseekMaxCompletionTokens ??
        parsePositiveInteger(process.env.DEEPSEEK_MAX_COMPLETION_TOKENS),
      fetchImpl,
    }),
  claude: (options, fetchImpl) =>
    createClaudeFailureAnalyzer({
      apiKey: options.claudeApiKey ?? process.env.CLAUDE_API_KEY ?? "",
      model: options.claudeModel ?? process.env.CLAUDE_MODEL,
      maxCompletionTokens:
        options.claudeMaxCompletionTokens ??
        parsePositiveInteger(process.env.CLAUDE_MAX_COMPLETION_TOKENS),
      fetchImpl,
    }),
  openai: (options, fetchImpl) =>
    createOpenAiFailureAnalyzer({
      apiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? "",
      model: options.openAiModel ?? process.env.OPENAI_MODEL,
      maxCompletionTokens:
        options.openAiMaxCompletionTokens ??
        parsePositiveInteger(process.env.OPENAI_MAX_COMPLETION_TOKENS),
      fetchImpl,
    }),
};

export function createAiProvider(
  providerName: AiProviderName,
  options: AiProviderOptions = {},
): FailureAnalyzer {
  const factory = PROVIDER_FACTORIES[providerName];
  return factory(options, options.fetchImpl);
}
