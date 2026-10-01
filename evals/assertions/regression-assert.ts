/**
 * Layer 1 structural checks for the expanded regression suite.
 * Does not replace unsupported-market-data.ts and is not a semantic judge.
 */

const UNAVAILABLE_PHRASES = [
  "unavailable",
  "not available",
  "does not include",
  "do not include",
  "not in the supplied",
  "not present in the supplied",
  "missing from",
];

export type RegressionChecks = {
  requireAnyMentions?: unknown;
  requireAllMentions?: unknown;
  forbidMentions?: unknown;
  requireUnavailable?: unknown;
  forbidPipeTables?: unknown;
  requireSymbolOrder?: unknown;
  forbidCurrentPriceAsYesterday?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
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

function hasPipeTable(output: string): boolean {
  return output.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) {
      return false;
    }

    return /^\|.*\|$/.test(trimmed) || /\|-+\|/.test(trimmed) || (trimmed.match(/\|/g) ?? []).length >= 3;
  });
}

function symbolOrder(output: string, symbols: string[]): string[] | null {
  const found: { symbol: string; index: number }[] = [];
  const haystack = output.toUpperCase();

  for (const symbol of symbols) {
    const token = symbol.toUpperCase();
    const match = haystack.match(new RegExp(`\\b${token}\\b`));
    if (!match || match.index === undefined) {
      return null;
    }
    found.push({ symbol: token, index: match.index });
  }

  return [...found].sort((left, right) => left.index - right.index).map((item) => item.symbol);
}

export function assertRegressionOutput(
  output: string,
  checks: RegressionChecks,
): { pass: boolean; score: number; reason: string } {
  const fail = (detail: string) => ({
    pass: false,
    score: 0,
    reason: `Deterministic regression (heuristic). ${detail}`,
  });

  if (!output.trim()) {
    return fail("Output was empty.");
  }

  const requireAnyMentions = asStringArray(checks.requireAnyMentions);
  if (requireAnyMentions.length > 0) {
    const matched = requireAnyMentions.some((mention) => outputMentionsValue(output, mention));
    if (!matched) {
      return fail(`Expected at least one of: ${requireAnyMentions.join(", ")}.`);
    }
  }

  const requireAllMentions = asStringArray(checks.requireAllMentions);
  const missingRequired = requireAllMentions.find((mention) => !outputMentionsValue(output, mention));
  if (missingRequired) {
    return fail(`Expected the response to mention "${missingRequired}".`);
  }

  const forbidMentions = asStringArray(checks.forbidMentions);
  const leaked = forbidMentions.find((mention) => outputMentionsValue(output, mention));
  if (leaked) {
    return fail(`Forbidden unsupported string is present: "${leaked}".`);
  }

  if (checks.requireUnavailable === true) {
    const hasUnavailable = UNAVAILABLE_PHRASES.some((phrase) => output.toLowerCase().includes(phrase));
    if (!hasUnavailable) {
      return fail("Expected the response to state that the requested information is unavailable in the supplied context.");
    }
  }

  if (checks.forbidPipeTables === true && hasPipeTable(output)) {
    return fail("Response uses pipe-delimited table formatting, which the analyst contract forbids.");
  }

  const requiredOrder = asStringArray(checks.requireSymbolOrder).map((symbol) => symbol.toUpperCase());
  if (requiredOrder.length > 0) {
    const actualOrder = symbolOrder(output, requiredOrder);
    if (!actualOrder) {
      return fail(`Expected symbols in order ${requiredOrder.join(" → ")}.`);
    }
    if (actualOrder.join(",") !== requiredOrder.join(",")) {
      return fail(`Expected symbol order ${requiredOrder.join(" → ")}, found ${actualOrder.join(" → ")}.`);
    }
  }

  if (checks.forbidCurrentPriceAsYesterday === true) {
    const claimsYesterdayPrice = /yesterday[\s\S]{0,80}115[,.]?000|115[,.]?000[\s\S]{0,80}yesterday/i.test(
      output,
    );
    if (claimsYesterdayPrice) {
      return fail("Response presents the current BTC price as yesterday's price.");
    }
  }

  return {
    pass: true,
    score: 1,
    reason: "Deterministic regression (heuristic). Structural checks passed.",
  };
}

export default function regressionAssert(
  output: string,
  context: { vars?: { checks?: RegressionChecks } },
): { pass: boolean; score: number; reason: string } {
  return assertRegressionOutput(output, context.vars?.checks ?? {});
}
