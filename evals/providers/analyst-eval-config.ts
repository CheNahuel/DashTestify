/**
 * Eval-only config for live Crypto AI Analyst completions.
 * Separate from LLM_EVAL_JUDGE_PROVIDER. Does not change production routing.
 */

import type { AiProviderName } from "../../scripts/ai/types";

export const ANALYST_EVAL_PROVIDER_ENV = "CRYPTO_ANALYST_EVAL_PROVIDER";

const VALID_ANALYST_PROVIDERS = new Set<AiProviderName>([
  "claude",
  "openai",
  "gemini",
  "groq",
  "deepseek",
  "openrouter",
]);

export type LiveAnalystConfigStatus =
  | { configured: false; reason: string }
  | { configured: true; provider: AiProviderName; model: string };

/** Same model env defaults as production src/lib/ai/crypto-analyst.ts. */
export function resolveAnalystModel(provider: AiProviderName): string {
  switch (provider) {
    case "claude":
      return process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "gemini":
      return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    case "groq":
      return process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    case "deepseek":
      return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash:free";
    case "openrouter":
      return process.env.OPENROUTER_MODEL || "openrouter/free";
  }
}

function readApiKey(provider: AiProviderName): string | undefined {
  switch (provider) {
    case "claude":
      return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
  }
}

export function getLiveAnalystConfigStatus(): LiveAnalystConfigStatus {
  const rawProvider = process.env[ANALYST_EVAL_PROVIDER_ENV]?.trim();
  if (!rawProvider || rawProvider === "deterministic") {
    return {
      configured: false,
      reason:
        `${ANALYST_EVAL_PROVIDER_ENV} is not set to a live provider. ` +
        `Live grounding is opt-in and was not run. Use one of: ${[...VALID_ANALYST_PROVIDERS].join(", ")}.`,
    };
  }

  if (!VALID_ANALYST_PROVIDERS.has(rawProvider as AiProviderName)) {
    return {
      configured: false,
      reason:
        `${ANALYST_EVAL_PROVIDER_ENV}="${rawProvider}" is not a supported analyst provider. ` +
        `Use one of: ${[...VALID_ANALYST_PROVIDERS].join(", ")}.`,
    };
  }

  const provider = rawProvider as AiProviderName;
  const apiKey = readApiKey(provider);
  if (!apiKey) {
    const keyHint =
      provider === "claude" ? "CLAUDE_API_KEY or ANTHROPIC_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
    return {
      configured: false,
      reason: `Live analyst provider "${provider}" is selected but ${keyHint} is not set. Live grounding was not run.`,
    };
  }

  return { configured: true, provider, model: resolveAnalystModel(provider) };
}
