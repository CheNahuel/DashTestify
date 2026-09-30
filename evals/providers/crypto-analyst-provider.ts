import { buildCryptoSystemPrompt } from "../../src/lib/ai/crypto-analyst";
import { DETERMINISTIC_GROUNDING_DISCLAIMER } from "../assertions/unsupported-market-data";

type ProviderContext = {
  vars?: {
    query?: unknown;
    context?: unknown;
    dataSource?: unknown;
  };
};

type AssetLike = {
  symbol?: unknown;
  name?: unknown;
  priceUsd?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function formatUsd(priceUsd: string): string {
  const numeric = Number(priceUsd.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return priceUsd;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function completeDeterministically(context: Record<string, unknown>): string {
  const assets = Array.isArray(context.assets) ? context.assets : [];
  const btc = assets.find((asset): asset is AssetLike => {
    if (!asset || typeof asset !== "object") {
      return false;
    }

    return String((asset as AssetLike).symbol).toUpperCase() === "BTC";
  });

  const priceUsd = typeof btc?.priceUsd === "string" ? btc.priceUsd : undefined;
  if (!priceUsd) {
    return "The supplied market data does not include a BTC price.";
  }

  return `Bitcoin (BTC) is priced at **${formatUsd(priceUsd)}**.`;
}

/**
 * Eval-only adapter. Default completion is keyless and deterministic.
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

    // Production prompt construction (same function the app uses). v1 does not send this to a hosted LLM.
    const systemPrompt = buildCryptoSystemPrompt(marketContext, dataSource);

    if (providerMode !== "deterministic") {
      return {
        error:
          `Unsupported CRYPTO_ANALYST_EVAL_PROVIDER="${providerMode}". ` +
          `v1 only supports "deterministic" (no API key). Real providers can be added later on this adapter.`,
      };
    }

    void query;

    return {
      output: completeDeterministically(marketContext),
      metadata: {
        evaluationKind: "deterministic-grounding-heuristic",
        evaluationLayer: "deterministic-grounding",
        disclaimer: DETERMINISTIC_GROUNDING_DISCLAIMER,
        systemPromptLength: systemPrompt.length,
        usedProductionSystemPrompt: true,
      },
    };
  }
}
