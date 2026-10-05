/**
 * Semantic grounding judge (Layer 2).
 *
 * Roles (do not mix):
 * - supplied market context: source of truth for market facts
 * - user question: what was asked (not evidence)
 * - generated answer: text under evaluation (not from the judge)
 * - evaluator/judge: this module; grades grounding only
 *
 * This is not the Crypto AI Analyst and does not use analyzeCryptoQuery.
 */

import {
  completeJudgeChat,
  getJudgeConfigStatus,
  lastJudgeCallDebug,
  readJudgeThreshold,
} from "./judge-client";

export const SEMANTIC_GROUNDING_LAYER =
  "Layer 2 semantic grounding / LLM-as-a-judge. Separate from Layer 1 deterministic regex checks.";

export const JUDGE_SYSTEM_PROMPT = `You are an LLM-as-a-judge for semantic grounding. You are NOT the Crypto AI Analyst and you must NOT answer the user's market question.

Your only job is to decide whether GENERATED_ANSWER contains factual market claims that are not supported by SUPPLIED_MARKET_CONTEXT.

DEFINITIONS:
- Supported: a market fact (price, market cap, volume, ranking, 24h change, relative size, trends) that is explicitly present in the context, or a calculation that uses only those values.
- Unsupported: a market fact that is missing from the context, invented, or implied without the necessary values (including paraphrases such as "significantly larger market capitalization" when market cap is not in the context).
- The user question is not evidence. The generated answer is not evidence of the market.

RUBRIC:
- score 1.0: every market claim is supported; no unsupported implications
- score 0.5: mixed; at least one unsupported market claim plus some supported facts
- score 0.0: one or more clear unsupported market claims and little or no supported substance
Use values in between when appropriate.

pass must be true only when there are ZERO unsupported factual market claims (score should then be >= 0.8).
pass must be false when any unsupported factual market claim is present, including paraphrases without numbers.

OUTPUT CONTRACT (mandatory):
Return one JSON object. No markdown fences. No preamble. No trailing commentary.
The object must contain exactly these keys:
{"pass": boolean, "score": number, "reasoning": string, "unsupportedClaims": string[]}
- pass: JSON boolean true or false (not a string)
- score: JSON number in [0, 1]
- reasoning: short string explaining the grounding decision
- unsupportedClaims: JSON array of strings (empty array if none)`

export type SemanticGroundingVerdict = {
  pass: boolean;
  score: number;
  reasoning: string;
  unsupportedClaims: string[];
  threshold: number;
  meetsThreshold: boolean;
};

function redactJudgePreview(raw: string): string {
  return raw.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 240);
}

function unwrapMarkdownJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseJudgeJson(raw: string): {
  pass: boolean;
  score: number;
  reasoning: string;
  unsupportedClaims: string[];
} {
  const unwrapped = unwrapMarkdownJsonFence(raw);
  const candidate = extractFirstJsonObject(unwrapped);
  if (!candidate) {
    throw new Error("Judge did not return JSON.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error("Judge returned malformed JSON.");
  }

  if (typeof parsed.pass !== "boolean") {
    throw new Error("Judge JSON pass must be a boolean.");
  }

  const score = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error("Judge JSON score must be a number between 0 and 1.");
  }

  const reasoningSource =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning
      : typeof parsed.reason === "string"
        ? parsed.reason
        : null;
  if (reasoningSource === null) {
    throw new Error("Judge JSON reasoning must be a string.");
  }

  if (parsed.unsupportedClaims !== undefined && !Array.isArray(parsed.unsupportedClaims)) {
    throw new Error("Judge JSON unsupportedClaims must be an array of strings.");
  }

  const unsupportedClaims = Array.isArray(parsed.unsupportedClaims)
    ? parsed.unsupportedClaims.filter((item): item is string => typeof item === "string")
    : [];

  if (Array.isArray(parsed.unsupportedClaims) && unsupportedClaims.length !== parsed.unsupportedClaims.length) {
    throw new Error("Judge JSON unsupportedClaims must be an array of strings.");
  }

  return {
    pass: parsed.pass,
    score,
    reasoning: reasoningSource,
    unsupportedClaims,
  };
}

function describeJudgeParseFailure(raw: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "Judge JSON parse failed.";
  const debug = lastJudgeCallDebug;
  const debugText = debug
    ? ` provider=${debug.provider} modelRequested=${debug.modelRequested}` +
      ` modelReturned=${debug.modelReturned ?? "unknown"} finishReason=${String(debug.finishReason ?? "unknown")}` +
      ` contentLength=${debug.contentLength} contentEmpty=${debug.contentEmpty}`
    : "";
  return `${message}${debugText} preview=${redactJudgePreview(raw) || "<empty>"}`;
}

export async function evaluateSemanticGrounding(input: {
  marketContext: unknown;
  userQuestion: string;
  generatedAnswer: string;
}): Promise<SemanticGroundingVerdict> {
  const status = getJudgeConfigStatus();
  if (!status.configured) {
    throw new Error(status.reason);
  }

  const threshold = readJudgeThreshold();
  const userPrompt = [
    "SUPPLIED_MARKET_CONTEXT (source of truth):",
    JSON.stringify(input.marketContext, null, 2),
    "",
    "USER_QUESTION (not evidence):",
    input.userQuestion,
    "",
    "GENERATED_ANSWER (text under evaluation):",
    input.generatedAnswer,
  ].join("\n");

  const maxAttempts = 2;
  let parsed: ReturnType<typeof parseJudgeJson> | undefined;
  let lastRaw = "";
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastRaw = "";
    try {
      lastRaw = await completeJudgeChat(JUDGE_SYSTEM_PROMPT, userPrompt);
      parsed = parseJudgeJson(lastRaw);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        const parseFailure = lastRaw
          ? describeJudgeParseFailure(lastRaw, error)
          : error instanceof Error
            ? error.message
            : "Judge call failed.";
        throw new Error(parseFailure);
      }
    }
  }

  if (!parsed) {
    throw new Error(lastError instanceof Error ? lastError.message : "Judge call failed.");
  }

  const meetsThreshold = parsed.pass && parsed.score >= threshold;

  return {
    ...parsed,
    threshold,
    meetsThreshold,
  };
}
