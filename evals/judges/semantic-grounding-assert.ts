import { evaluateSemanticGrounding, SEMANTIC_GROUNDING_LAYER } from "./semantic-grounding-judge";

type PromptfooContext = {
  vars?: {
    query?: unknown;
    context?: unknown;
    generatedAnswer?: unknown;
    expectedJudgePass?: unknown;
  };
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

export default async function semanticGroundingAssert(
  output: string,
  context: PromptfooContext,
): Promise<{ pass: boolean; score: number; reason: string }> {
  const vars = context.vars ?? {};
  const userQuestion = typeof vars.query === "string" ? vars.query : "";
  const generatedAnswer = typeof vars.generatedAnswer === "string" ? vars.generatedAnswer : output;
  const expectedJudgePass = asBoolean(vars.expectedJudgePass, true);

  const verdict = await evaluateSemanticGrounding({
    marketContext: vars.context,
    userQuestion,
    generatedAnswer,
  });

  const judgeSaysGrounded = verdict.meetsThreshold;
  const matchesExpectation = judgeSaysGrounded === expectedJudgePass;
  const unsupported =
    verdict.unsupportedClaims.length > 0 ? ` Unsupported claims: ${verdict.unsupportedClaims.join("; ")}` : "";

  return {
    pass: matchesExpectation,
    score: verdict.score,
    reason:
      `${SEMANTIC_GROUNDING_LAYER} ` +
      `expectedJudgePass=${expectedJudgePass}; judgeMeetThreshold=${judgeSaysGrounded}; ` +
      `judge.pass=${verdict.pass}; score=${verdict.score}; threshold=${verdict.threshold}. ` +
      `${verdict.reasoning}${unsupported}`,
  };
}
