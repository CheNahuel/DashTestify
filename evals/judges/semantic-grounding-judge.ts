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

import { completeJudgeChat, getJudgeConfigStatus, readJudgeThreshold } from "./judge-client";

export const SEMANTIC_GROUNDING_LAYER =
  "Layer 2 semantic grounding / LLM-as-a-judge. Separate from Layer 1 deterministic regex checks.";

const JUDGE_SYSTEM_PROMPT = `You are an LLM-as-a-judge for semantic grounding. You are NOT the Crypto AI Analyst and you must NOT answer the user's market question.

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

Reply with JSON only:
{"pass": boolean, "score": number, "reasoning": string, "unsupportedClaims": string[]}`;

export type SemanticGroundingVerdict = {
  pass: boolean;
  score: number;
  reasoning: string;
  unsupportedClaims: string[];
  threshold: number;
  meetsThreshold: boolean;
};

function parseJudgeJson(raw: string): {
  pass: boolean;
  score: number;
  reasoning: string;
  unsupportedClaims: string[];
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Judge did not return JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const score = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error("Judge JSON score must be a number between 0 and 1.");
  }

  const unsupportedClaims = Array.isArray(parsed.unsupportedClaims)
    ? parsed.unsupportedClaims.filter((item): item is string => typeof item === "string")
    : [];

  return {
    pass: Boolean(parsed.pass),
    score,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    unsupportedClaims,
  };
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

  const raw = await completeJudgeChat(JUDGE_SYSTEM_PROMPT, userPrompt);
  const parsed = parseJudgeJson(raw);
  const meetsThreshold = parsed.pass && parsed.score >= threshold;

  return {
    ...parsed,
    threshold,
    meetsThreshold,
  };
}
