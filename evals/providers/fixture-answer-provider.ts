/**
 * Eval-only subject provider. Echoes a fixture generated answer so the judge can grade it.
 * This is not the Crypto AI Analyst and not the evaluator/judge.
 */

type ProviderContext = {
  vars?: {
    generatedAnswer?: unknown;
    query?: unknown;
    context?: unknown;
  };
};

export default class FixtureAnswerProvider {
  id(): string {
    return "fixture-generated-answer";
  }

  async callApi(_prompt: string, context?: ProviderContext) {
    const generatedAnswer = context?.vars?.generatedAnswer;
    if (typeof generatedAnswer !== "string" || !generatedAnswer.trim()) {
      return { error: "vars.generatedAnswer is required (the text under evaluation)." };
    }

    return {
      output: generatedAnswer,
      metadata: {
        evaluationKind: "semantic-grounding-llm-judge",
        evaluationLayer: "semantic-grounding",
        role: "generated-answer-fixture",
        notTheJudge: true,
        notTheCryptoAnalyst: true,
      },
    };
  }
}
