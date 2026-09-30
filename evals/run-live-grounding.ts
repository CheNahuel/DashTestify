import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import { getJudgeConfigStatus } from "./judges/judge-client";
import { getLiveAnalystConfigStatus } from "./providers/analyst-eval-config";

loadDotenv();

const SKIP_EXIT_CODE = 2;

function printSkip(reason: string): never {
  console.log("LLM_EVAL_STATUS=SKIPPED");
  console.log("Live analyst grounding was not run.");
  console.log(reason);
  console.log(
    "Configure CRYPTO_ANALYST_EVAL_PROVIDER (claude|openai|gemini|groq|deepseek|openrouter) " +
      "and the matching API key, plus LLM_EVAL_JUDGE_PROVIDER and its matching API key.",
  );
  console.log("Layer 1 remains: npm run test:llm");
  console.log("Fixture Layer 2 remains: npm run test:llm:semantic");
  process.exit(SKIP_EXIT_CODE);
}

const analystStatus = getLiveAnalystConfigStatus();
if (!analystStatus.configured) {
  printSkip(analystStatus.reason);
}

const judgeStatus = getJudgeConfigStatus();
if (!judgeStatus.configured) {
  printSkip(judgeStatus.reason);
}

console.log("LLM_EVAL_STATUS=RUNNING");
console.log(
  `Live analyst provider=${analystStatus.provider}; ` +
    `judge provider=${judgeStatus.provider} threshold=${judgeStatus.threshold} ` +
    `(API keys present, values not logged).`,
);

const promptfooBin = path.join(process.cwd(), "node_modules", ".bin", "promptfoo");
const child = spawn(
  promptfooBin,
  ["eval", "-c", "evals/promptfooconfig.live-grounding.yaml", "--no-cache"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
