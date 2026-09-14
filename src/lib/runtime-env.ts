/**
 * Local QA tools (run Playwright from the UI, AI analyze/apply) must never run
 * on deployed environments. Optional request header `x-qa-local-tools: 0` lets
 * Playwright verify the production redirect/guards while the app still runs
 * under `next dev`.
 */
export function areLocalQaToolsEnabled(
  env: NodeJS.ProcessEnv = process.env,
  requestHeaders?: Headers | null,
): boolean {
  const isDeployed = env.NODE_ENV === "production" || env.VERCEL === "1";

  if (isDeployed) {
    return false;
  }

  if (requestHeaders?.get("x-qa-local-tools") === "0") {
    return false;
  }

  return true;
}
