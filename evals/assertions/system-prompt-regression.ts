/**
 * Keyless prompt-regression checks on the production Crypto AI Analyst system prompt.
 * This is not a hallucination detector and does not call a hosted LLM.
 */

const GROUNDING_PHRASES = [
  "Never invent prices, trends, percentages, rankings, or market information.",
  "Only use facts and values explicitly provided in the context.",
  "Use only values and facts present in the supplied data.",
  "never introduce external data",
];

type PromptfooContext = {
  vars?: {
    context?: unknown;
    promptCheck?: unknown;
  };
};

function contextSection(systemPrompt: string): string {
  const marker = "DATA / CONTEXT:";
  const index = systemPrompt.indexOf(marker);
  if (index === -1) {
    return "";
  }
  return systemPrompt.slice(index);
}

export function assertSystemPromptRegression(
  systemPrompt: string,
  vars: { context?: unknown; promptCheck?: unknown },
): { pass: boolean; score: number; reason: string } {
  const fail = (detail: string) => ({
    pass: false,
    score: 0,
    reason: `Prompt regression (keyless). ${detail}`,
  });

  if (!systemPrompt.trim()) {
    return fail("Production system prompt was empty.");
  }

  const check = typeof vars.promptCheck === "string" ? vars.promptCheck : "grounding-rules";

  if (check === "grounding-rules") {
    const missing = GROUNDING_PHRASES.filter((phrase) => !systemPrompt.includes(phrase));
    if (missing.length > 0) {
      return fail(`Missing required grounding instruction(s): ${missing.join(" | ")}`);
    }

    return {
      pass: true,
      score: 1,
      reason:
        "Prompt regression (keyless). Production system prompt still contains the required grounding rules.",
    };
  }

  if (check === "embedded-context") {
    const section = contextSection(systemPrompt);
    if (!section) {
      return fail("Production system prompt has no DATA / CONTEXT section.");
    }

    if (!section.includes('"priceUsd": "115000"') || !section.includes('"priceUsd": "4200"')) {
      return fail(
        "DATA / CONTEXT does not embed the fixture BTC ($115000) and ETH ($4200) prices from vars.context.",
      );
    }

    return {
      pass: true,
      score: 1,
      reason:
        "Prompt regression (keyless). Fixture market context is embedded in the production DATA / CONTEXT section.",
    };
  }

  return fail(`Unknown vars.promptCheck="${String(check)}". Use grounding-rules or embedded-context.`);
}

export default function systemPromptRegressionAssert(
  output: string,
  context: PromptfooContext,
): { pass: boolean; score: number; reason: string } {
  return assertSystemPromptRegression(output, context.vars ?? {});
}
