import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import { getJudgeConfigStatus } from "./judges/judge-client";
import { printLiveBenchmarkSummary, writeLiveBenchmarkSummary } from "./live-benchmark-summary";
import { getLiveAnalystConfigStatus } from "./providers/analyst-eval-config";

loadDotenv();

const SKIP_EXIT_CODE = 2;

function printSkip(reason: string): never {
  console.log("LLM_EVAL_STATUS=SKIPPED");
  console.log("Live provider benchmark (production analyzeCryptoQuery) was not run.");
  console.log(reason);
  console.log(
    "Configure CRYPTO_ANALYST_EVAL_PROVIDER (claude|openai|gemini|groq|deepseek|openrouter) " +
      "and the matching API key, plus LLM_EVAL_JUDGE_PROVIDER " +
      "(claude|openai|gemini|groq|deepseek|openrouter|ollama).",
  );
  console.log("Layer 1 remains: npm run test:llm (keyless, deployment gate).");
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
  `Live provider benchmark uses production analyzeCryptoQuery + buildCryptoSystemPrompt. ` +
    `analystProvider=${analystStatus.provider} analystModel=${analystStatus.model} ` +
    `judgeProvider=${judgeStatus.provider} judgeModel=${judgeStatus.model} ` +
    `dataset=semantic-grounding-live-v1 (API keys not logged).`,
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
  const exitCode = signal ? 1 : code ?? 1;
  void (async () => {
    try {
      const summary = await writeLiveBenchmarkSummary({
        analystProvider: analystStatus.provider,
        analystModel: analystStatus.model,
        judgeProvider: judgeStatus.provider,
        judgeModel: judgeStatus.model,
      });
      printLiveBenchmarkSummary(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`LLM_EVAL_BENCHMARK_SUMMARY=ERROR ${message}`);
    }
    process.exit(exitCode);
  })();
});
