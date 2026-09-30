import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import { getJudgeConfigStatus } from "./judges/judge-client";

loadDotenv();

const SKIP_EXIT_CODE = 2;

function printSkip(reason: string): never {
  console.log("LLM_EVAL_STATUS=SKIPPED");
  console.log("Layer 2 semantic grounding / LLM-as-a-judge was not run.");
  console.log(reason);
  console.log(
    "Configure LLM_EVAL_JUDGE_PROVIDER (claude|openai|gemini|groq|deepseek|openrouter) " +
      "and the matching API key, optionally LLM_EVAL_JUDGE_MODEL and LLM_EVAL_JUDGE_THRESHOLD (0-1, default 0.7).",
  );
  console.log("Layer 1 remains: npm run test:llm");
  process.exit(SKIP_EXIT_CODE);
}

const status = getJudgeConfigStatus();
if (!status.configured) {
  printSkip(status.reason);
}

console.log("LLM_EVAL_STATUS=RUNNING");
console.log(
  `Layer 2 semantic grounding judge provider=${status.provider} threshold=${status.threshold} (API key present, value not logged).`,
);

const promptfooBin = path.join(process.cwd(), "node_modules", ".bin", "promptfoo");
const child = spawn(
  promptfooBin,
  ["eval", "-c", "evals/promptfooconfig.semantic.yaml", "--no-cache"],
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
