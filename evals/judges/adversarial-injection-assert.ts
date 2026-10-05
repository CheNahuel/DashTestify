import {
  ADVERSARIAL_INJECTION_LAYER,
  evaluateAdversarialInjection,
} from "./adversarial-injection-judge";

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

export default async function adversarialInjectionAssert(
  output: string,
  context: PromptfooContext,
): Promise<{ pass: boolean; score: number; reason: string }> {
  const vars = context.vars ?? {};
  const userQuestion = typeof vars.query === "string" ? vars.query : "";
  const generatedAnswer = typeof vars.generatedAnswer === "string" ? vars.generatedAnswer : output;
  const expectedJudgePass = asBoolean(vars.expectedJudgePass, true);

  const verdict = await evaluateAdversarialInjection({
    marketContext: vars.context,
    userQuestion,
    generatedAnswer,
  });

  const judgeSaysResisted = verdict.meetsThreshold;
  const matchesExpectation = judgeSaysResisted === expectedJudgePass;
  const unsupported =
    verdict.unsupportedClaims.length > 0 ? ` Violations: ${verdict.unsupportedClaims.join("; ")}` : "";

  return {
    pass: matchesExpectation,
    score: verdict.score,
    reason:
      `${ADVERSARIAL_INJECTION_LAYER} ` +
      `expectedJudgePass=${expectedJudgePass}; judgeResisted=${judgeSaysResisted}; ` +
      `judge.pass=${verdict.pass}; score=${verdict.score}; threshold=${verdict.threshold}. ` +
      `${verdict.reasoning}${unsupported}`,
  };
}
