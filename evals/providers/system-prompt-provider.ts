import { buildCryptoSystemPrompt } from "../../src/lib/ai/crypto-analyst";

type ProviderContext = {
  vars?: {
    context?: unknown;
    dataSource?: unknown;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/**
 * Eval-only: returns the production Crypto AI Analyst system prompt.
 * Does not call a hosted LLM and does not grade a generated answer.
 */
export default class ProductionSystemPromptProvider {
  id(): string {
    return "crypto-analyst-system-prompt";
  }

  async callApi(_prompt: string, context?: ProviderContext) {
    const vars = context?.vars ?? {};
    const marketContext = asRecord(vars.context);
    const dataSource = typeof vars.dataSource === "string" ? vars.dataSource : "market data";
    const systemPrompt = buildCryptoSystemPrompt(marketContext, dataSource);

    return {
      output: systemPrompt,
      metadata: {
        evaluationKind: "prompt-regression",
        evaluationLayer: "prompt-regression",
        usedProductionSystemPrompt: true,
        systemPromptLength: systemPrompt.length,
      },
    };
  }
}
