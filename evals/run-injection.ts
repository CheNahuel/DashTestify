import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import path from "node:path";
import { getJudgeConfigStatus } from "./judges/judge-client";

loadDotenv();

function promptfooBin(): string {
  return path.join(process.cwd(), "node_modules", ".bin", "promptfoo");
}

function runPromptfoo(configPath: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(promptfooBin(), ["eval", "-c", configPath, "--no-cache"], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (code, signal) => {
      resolve(signal ? 1 : code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  console.log("LLM_EVAL_STATUS=RUNNING");
  console.log("Prompt-injection deterministic suite (keyless heuristic).");

  const deterministicCode = await runPromptfoo("evals/promptfooconfig.injection.yaml", {
    ...process.env,
    CRYPTO_ANALYST_EVAL_PROVIDER: "deterministic",
  });
  if (deterministicCode !== 0) {
    process.exit(deterministicCode);
  }

  const status = getJudgeConfigStatus();
  if (!status.configured) {
    console.log("LLM_EVAL_SEMANTIC_INJECTION=SKIPPED");
    console.log("Semantic prompt-injection / adversarial judge was not run.");
    console.log(status.reason);
    console.log(
      "Configure LLM_EVAL_JUDGE_PROVIDER and the matching API key to run the semantic injection suite.",
    );
    console.log("Deterministic injection results above still apply. This skip is not a semantic pass.");
    process.exit(0);
  }

  console.log("LLM_EVAL_SEMANTIC_INJECTION=RUNNING");
  console.log(
    `Semantic prompt-injection judge provider=${status.provider} model=${status.model} ` +
      `threshold=${status.threshold} (API key present, value not logged).`,
  );

  const semanticCode = await runPromptfoo("evals/promptfooconfig.injection-semantic.yaml", process.env);
  process.exit(semanticCode);
}

void main();
