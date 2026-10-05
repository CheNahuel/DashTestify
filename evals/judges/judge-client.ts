/**
 * Eval-only LLM-as-a-judge client. Separate from Crypto AI Analyst production providers
 * and from scripts/ai failure analyzers. Keys are read from the environment only.
 */

export const JUDGE_PROVIDER_ENV = "LLM_EVAL_JUDGE_PROVIDER";
export const JUDGE_MODEL_ENV = "LLM_EVAL_JUDGE_MODEL";
export const JUDGE_THRESHOLD_ENV = "LLM_EVAL_JUDGE_THRESHOLD";
export const DEFAULT_JUDGE_THRESHOLD = 0.7;

/** Eval-only OpenRouter default. Not used by production Crypto AI Analyst. */
export const RECOMMENDED_OPENROUTER_JUDGE_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

export type JudgeProviderName =
  | "claude"
  | "openai"
  | "gemini"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama";

const VALID_JUDGE_PROVIDERS = new Set<JudgeProviderName>([
  "claude",
  "openai",
  "gemini",
  "groq",
  "deepseek",
  "openrouter",
  "ollama",
]);

export type LastJudgeCallDebug = {
  provider: JudgeProviderName;
  modelRequested: string;
  modelReturned?: string;
  finishReason?: unknown;
  contentLength: number;
  contentEmpty: boolean;
};

const JUDGE_MAX_TOKENS = 4096;

export function resolveJudgeModel(provider: JudgeProviderName): string {
  const override = process.env[JUDGE_MODEL_ENV]?.trim();
  if (override) {
    return override;
  }

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
      return process.env.DEEPSEEK_MODEL || "deepseek-chat";
    case "openrouter":
      return RECOMMENDED_OPENROUTER_JUDGE_MODEL;
    case "ollama":
      return "";
  }
}

function jsonObjectResponseFormat(): { type: "json_object" } {
  return { type: "json_object" };
}

export let lastJudgeCallDebug: LastJudgeCallDebug | null = null;

type GenericApiResponse = Record<string, unknown>;

export type JudgeConfigStatus =
  | { configured: false; reason: string }
  | { configured: true; provider: JudgeProviderName; model: string; threshold: number };

function readApiKey(provider: JudgeProviderName): string | undefined {
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
    case "ollama":
      return undefined;
  }
}

export function readJudgeThreshold(): number {
  const raw = process.env[JUDGE_THRESHOLD_ENV];
  if (!raw) {
    return DEFAULT_JUDGE_THRESHOLD;
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(
      `${JUDGE_THRESHOLD_ENV} must be a number between 0 and 1 inclusive. Received: ${raw}`,
    );
  }

  return parsed;
}

export function getJudgeConfigStatus(): JudgeConfigStatus {
  const rawProvider = process.env[JUDGE_PROVIDER_ENV]?.trim();
  if (!rawProvider) {
    return {
      configured: false,
      reason: `${JUDGE_PROVIDER_ENV} is not set. Layer 2 is opt-in and was not run.`,
    };
  }

  if (!VALID_JUDGE_PROVIDERS.has(rawProvider as JudgeProviderName)) {
    return {
      configured: false,
      reason:
        `${JUDGE_PROVIDER_ENV}="${rawProvider}" is not a supported evaluator. ` +
        `Use one of: ${[...VALID_JUDGE_PROVIDERS].join(", ")}.`,
    };
  }

  const provider = rawProvider as JudgeProviderName;
  if (provider === "ollama") {
    const model = process.env[JUDGE_MODEL_ENV]?.trim();
    if (!model) {
      return {
        configured: false,
        reason:
          `Evaluator provider "ollama" requires ${JUDGE_MODEL_ENV} (local model name). Layer 2 was not run.`,
      };
    }
    return {
      configured: true,
      provider,
      model,
      threshold: readJudgeThreshold(),
    };
  }

  const apiKey = readApiKey(provider);
  if (!apiKey) {
    const keyHint =
      provider === "claude" ? "CLAUDE_API_KEY or ANTHROPIC_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
    return {
      configured: false,
      reason: `Evaluator provider "${provider}" is selected but ${keyHint} is not set. Layer 2 was not run.`,
    };
  }

  return {
    configured: true,
    provider,
    model: resolveJudgeModel(provider),
    threshold: readJudgeThreshold(),
  };
}

function extractResponseText(data: GenericApiResponse): string {
  if (Array.isArray(data.content)) {
    const textBlock = (data.content as Array<{ type: string; text?: string }>).find(
      (block) => block.type === "text",
    );
    if (textBlock?.text) {
      return textBlock.text.trim();
    }
  }

  if (Array.isArray(data.choices)) {
    const choice = (
      data.choices as Array<{
        finish_reason?: unknown;
        message?: { content?: unknown; reasoning?: unknown };
      }>
    )[0];
    const content = choice?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const parts = content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .join("");
      if (parts.trim()) {
        return parts.trim();
      }
    }
  }

  if (Array.isArray(data.candidates)) {
    const candidate = (
      data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>
    )[0];
    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text.trim();
    }
  }

  if (data.message && typeof data.message === "object") {
    const message = data.message as { content?: unknown };
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }

  return "";
}

function ollamaHost(): string {
  return (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function recordJudgeDebug(
  provider: JudgeProviderName,
  modelRequested: string,
  data: GenericApiResponse,
  text: string,
): void {
  const choice = Array.isArray(data.choices)
    ? (data.choices as Array<{ finish_reason?: unknown; native_finish_reason?: unknown }>)[0]
    : undefined;

  lastJudgeCallDebug = {
    provider,
    modelRequested,
    modelReturned: typeof data.model === "string" ? data.model : undefined,
    finishReason: choice?.finish_reason ?? choice?.native_finish_reason ?? data.finishReason,
    contentLength: text.length,
    contentEmpty: text.length === 0,
  };
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.text();
    return body.slice(0, 300);
  } catch {
    return "";
  }
}

export async function completeJudgeChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const status = getJudgeConfigStatus();
  if (!status.configured) {
    throw new Error(status.reason);
  }

  const provider = status.provider;
  const apiKey = readApiKey(provider) ?? "";
  if (provider !== "ollama" && !apiKey) {
    throw new Error("Evaluator API key is missing.");
  }

  switch (provider) {
    case "claude": {
      const model = resolveJudgeModel(provider);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: JUDGE_MAX_TOKENS,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Judge Claude API error: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge Claude returned an empty response");
      return text;
    }
    case "openai": {
      const model = resolveJudgeModel(provider);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: JUDGE_MAX_TOKENS,
          temperature: 0,
          response_format: jsonObjectResponseFormat(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Judge OpenAI API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge OpenAI returned an empty response");
      return text;
    }
    case "gemini": {
      const model = resolveJudgeModel(provider);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: JUDGE_MAX_TOKENS,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Judge Gemini API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge Gemini returned an empty response");
      return text;
    }
    case "groq": {
      const model = resolveJudgeModel(provider);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_completion_tokens: JUDGE_MAX_TOKENS,
          temperature: 0,
          response_format: jsonObjectResponseFormat(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Judge Groq API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge Groq returned an empty response");
      return text;
    }
    case "deepseek": {
      const model = resolveJudgeModel(provider);
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: JUDGE_MAX_TOKENS,
          temperature: 0,
          response_format: jsonObjectResponseFormat(),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Judge DeepSeek API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge DeepSeek returned an empty response");
      return text;
    }
    case "openrouter": {
      const model = resolveJudgeModel(provider);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dashtestify.local",
          "X-Title": "DashTestify LLM eval judge",
        },
        body: JSON.stringify({
          model,
          max_tokens: JUDGE_MAX_TOKENS,
          temperature: 0,
          response_format: jsonObjectResponseFormat(),
          provider: { require_parameters: true },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Judge OpenRouter API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge OpenRouter returned an empty response");
      return text;
    }
    case "ollama": {
      const model = status.model;
      const response = await fetch(`${ollamaHost()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          options: { temperature: 0, num_predict: JUDGE_MAX_TOKENS },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Judge Ollama API error: ${response.status} ${response.statusText} ${await readErrorBody(response)}`,
        );
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      recordJudgeDebug(provider, model, data, text);
      if (!text) throw new Error("Judge Ollama returned an empty response");
      return text;
    }
  }
}
