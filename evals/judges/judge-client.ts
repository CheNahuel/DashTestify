/**
 * Eval-only LLM-as-a-judge client. Separate from Crypto AI Analyst production providers
 * and from scripts/ai failure analyzers. Keys are read from the environment only.
 */

export const JUDGE_PROVIDER_ENV = "LLM_EVAL_JUDGE_PROVIDER";
export const JUDGE_MODEL_ENV = "LLM_EVAL_JUDGE_MODEL";
export const JUDGE_THRESHOLD_ENV = "LLM_EVAL_JUDGE_THRESHOLD";
export const DEFAULT_JUDGE_THRESHOLD = 0.7;

export type JudgeProviderName =
  | "claude"
  | "openai"
  | "gemini"
  | "groq"
  | "deepseek"
  | "openrouter";

const VALID_JUDGE_PROVIDERS = new Set<JudgeProviderName>([
  "claude",
  "openai",
  "gemini",
  "groq",
  "deepseek",
  "openrouter",
]);

type GenericApiResponse = Record<string, unknown>;

export type JudgeConfigStatus =
  | { configured: false; reason: string }
  | { configured: true; provider: JudgeProviderName; threshold: number };

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
    const choice = (data.choices as Array<{ message?: { content?: string } }>)[0];
    if (choice?.message?.content) {
      return choice.message.content.trim();
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

  return "";
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
  const apiKey = readApiKey(provider);
  if (!apiKey) {
    throw new Error("Evaluator API key is missing.");
  }

  switch (provider) {
    case "claude": {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env[JUDGE_MODEL_ENV] || process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`Judge Claude API error: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as GenericApiResponse;
      const text = extractResponseText(data);
      if (!text) throw new Error("Judge Claude returned an empty response");
      return text;
    }
    case "openai": {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env[JUDGE_MODEL_ENV] || process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: 1024,
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
      if (!text) throw new Error("Judge OpenAI returned an empty response");
      return text;
    }
    case "gemini": {
      const model = process.env[JUDGE_MODEL_ENV] || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
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
      if (!text) throw new Error("Judge Gemini returned an empty response");
      return text;
    }
    case "groq": {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env[JUDGE_MODEL_ENV] || process.env.GROQ_MODEL || "openai/gpt-oss-20b",
          max_completion_tokens: 1024,
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
      if (!text) throw new Error("Judge Groq returned an empty response");
      return text;
    }
    case "deepseek": {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env[JUDGE_MODEL_ENV] || process.env.DEEPSEEK_MODEL || "deepseek-chat",
          max_tokens: 1024,
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
      if (!text) throw new Error("Judge DeepSeek returned an empty response");
      return text;
    }
    case "openrouter": {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dashtestify.local",
          "X-Title": "DashTestify LLM eval judge",
        },
        body: JSON.stringify({
          model: process.env[JUDGE_MODEL_ENV] || process.env.OPENROUTER_MODEL || "openrouter/free",
          max_tokens: 1024,
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
      if (!text) throw new Error("Judge OpenRouter returned an empty response");
      return text;
    }
  }
}
