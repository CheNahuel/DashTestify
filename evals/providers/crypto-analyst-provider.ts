import { analyzeCryptoQuery, buildCryptoSystemPrompt } from "../../src/lib/ai/crypto-analyst";
import { DETERMINISTIC_GROUNDING_DISCLAIMER } from "../assertions/unsupported-market-data";
import { getLiveAnalystConfigStatus } from "./analyst-eval-config";
import { completeDeterministically } from "./deterministic-completer";

type ProviderContext = {
  vars?: {
    query?: unknown;
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
 * Eval-only adapter. Default completion is keyless and deterministic.
 * Live mode calls production analyzeCryptoQuery when CRYPTO_ANALYST_EVAL_PROVIDER is a real provider.
 * Does not add a mock provider to production AiProviderName routing.
 */
export default class CryptoAnalystEvalProvider {
  id(): string {
    return "crypto-analyst-eval";
  }

  async callApi(prompt: string, context?: ProviderContext) {
    const vars = context?.vars ?? {};
    const query = typeof vars.query === "string" ? vars.query : prompt;
    const marketContext = asRecord(vars.context);
    const dataSource = typeof vars.dataSource === "string" ? vars.dataSource : "market data";
    const providerMode = process.env.CRYPTO_ANALYST_EVAL_PROVIDER ?? "deterministic";

    const systemPrompt = buildCryptoSystemPrompt(marketContext, dataSource);

    if (providerMode === "deterministic" || !providerMode.trim()) {
      return {
        output: completeDeterministically(query, marketContext),
        metadata: {
          evaluationKind: "deterministic-grounding-heuristic",
          evaluationLayer: "deterministic-grounding",
          disclaimer: DETERMINISTIC_GROUNDING_DISCLAIMER,
          systemPromptLength: systemPrompt.length,
          usedProductionSystemPrompt: true,
        },
      };
    }

    const liveStatus = getLiveAnalystConfigStatus();
    if (!liveStatus.configured) {
      return { error: liveStatus.reason };
    }

    try {
      const analysis = await analyzeCryptoQuery(
        {
          query,
          context: marketContext,
          endpoints: ["eval-fixture-context"],
        },
        liveStatus.provider,
      );

      return {
        output: analysis.answer,
        metadata: {
          evaluationKind: "live-analyst-semantic-grounding",
          evaluationLayer: "live-analyst-grounding",
          analystProvider: analysis.provider,
          usedProductionAnalyzeCryptoQuery: true,
          usedProductionSystemPrompt: true,
          systemPromptLength: systemPrompt.length,
          notTheJudge: true,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  }
}
