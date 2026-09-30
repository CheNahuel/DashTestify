/**
 * Layer 1: deterministic / heuristic grounding checks.
 *
 * This is not a complete hallucination detector. It cannot catch paraphrased
 * unsupported claims that omit an exact numeric or market-stat pattern.
 * Layer 2 (semantic grounding / LLM-as-a-judge) is intentionally not implemented
 * here and should be added later without replacing this suite.
 */

export const DETERMINISTIC_GROUNDING_DISCLAIMER =
  "Deterministic grounding regression (heuristic). Not semantic hallucination detection and not proof that a hosted LLM cannot hallucinate.";

export type DeterministicGroundingVars = {
  context?: unknown;
  expectedPriceMentions?: unknown;
  unsupportedClaims?: unknown;
  grounding?: {
    expectedPriceMentions?: unknown;
    unsupportedClaims?: unknown;
  };
};

export type DeterministicGroundingResult = {
  pass: boolean;
  score: number;
  reason: string;
};

const MARKET_STAT_PATTERN =
  /\b(market\s*cap(?:italization)?|mcap|24h(?:\s*change)?|24-hour(?:\s*change)?|volume(?:\s*24h)?)\b[\s:–—-]*([+$€£]?\s*[\d,.]+(?:\s*%|\s*[KMBTkmbt])?)/gi;

function asStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function collectPrimitiveStrings(value: unknown, out: string[]): void {
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPrimitiveStrings(item, out);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      collectPrimitiveStrings(nested, out);
    }
  }
}

function compactAlphanumeric(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9.%+]/g, "");
}

function outputMentionsValue(output: string, candidate: string): boolean {
  const compactOutput = compactAlphanumeric(output);
  const compactCandidate = compactAlphanumeric(candidate);

  if (compactCandidate.length > 0 && compactOutput.includes(compactCandidate)) {
    return true;
  }

  return output.toLowerCase().includes(candidate.toLowerCase());
}

function contextContainsClaim(contextText: string, claim: string): boolean {
  const compactContext = compactAlphanumeric(contextText);
  const compactClaim = compactAlphanumeric(claim);

  if (compactClaim.length > 0 && compactContext.includes(compactClaim)) {
    return true;
  }

  return contextText.toLowerCase().includes(claim.toLowerCase());
}

export function assertDeterministicGrounding(
  output: string,
  vars: DeterministicGroundingVars,
): DeterministicGroundingResult {
  const fail = (detail: string): DeterministicGroundingResult => ({
    pass: false,
    score: 0,
    reason: `${DETERMINISTIC_GROUNDING_DISCLAIMER} ${detail}`,
  });

  const pass = (detail: string): DeterministicGroundingResult => ({
    pass: true,
    score: 1,
    reason: `${DETERMINISTIC_GROUNDING_DISCLAIMER} ${detail}`,
  });

  if (!output || !output.trim()) {
    return fail("Model output was empty.");
  }

  const expectedPriceMentions = asStringArray(
    vars.grounding?.expectedPriceMentions ?? vars.expectedPriceMentions,
  );
  if (expectedPriceMentions.length === 0) {
    return fail(
      "Test vars.grounding.expectedPriceMentions must list at least one supported price string.",
    );
  }

  const anyMentioned = expectedPriceMentions.some((mention) => outputMentionsValue(output, mention));
  if (!anyMentioned) {
    return fail(
      `Expected the response to mention a supported BTC price from context (e.g. ${expectedPriceMentions.join(", ")}).`,
    );
  }

  const contextValues: string[] = [];
  collectPrimitiveStrings(vars.context, contextValues);
  const contextBlob = contextValues.join(" ");

  const unsupportedClaims = asStringArray(
    vars.grounding?.unsupportedClaims ?? vars.unsupportedClaims,
  );
  const leakedClaim = unsupportedClaims.find(
    (claim) => outputMentionsValue(output, claim) && !contextContainsClaim(contextBlob, claim),
  );

  if (leakedClaim) {
    return fail(
      `Detected an obvious unsupported market-stat string that is not in the supplied context: "${leakedClaim}".`,
    );
  }

  for (const match of output.matchAll(MARKET_STAT_PATTERN)) {
    const label = match[1] ?? "market stat";
    const rawValue = match[2] ?? "";
    if (!rawValue.trim()) {
      continue;
    }

    if (!contextContainsClaim(contextBlob, rawValue) && !outputMentionsValue(contextBlob, rawValue)) {
      return fail(
        `Detected an obvious unsupported ${label} pattern ("${rawValue.trim()}") that is not present in the supplied context.`,
      );
    }
  }

  return pass(
    "Supported BTC price from context is present; no obvious unsupported market-stat patterns were detected.",
  );
}

export default function unsupportedMarketDataAssert(
  output: string,
  context: { vars?: DeterministicGroundingVars },
): DeterministicGroundingResult {
  return assertDeterministicGrounding(output, context.vars ?? {});
}
