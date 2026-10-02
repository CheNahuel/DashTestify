# Crypto AI Analyst LLM evals

Promptfoo owns LLM/prompt regression. Playwright remains UI and end-to-end testing.

Roles must stay distinct:

- **Supplied market context** — source of truth (`vars.context`)
- **User question** — what was asked (`vars.query`); not evidence
- **Generated answer** — text under evaluation
- **Evaluator / judge** — independent of the Crypto AI Analyst

These layers are additive. Semantic evaluation must not replace the deterministic suite. Live provider benchmarking must not replace the deployment gate.

## A. Deterministic regression (required CI / deployment gate)

```bash
npm run test:llm
```

Keyless, reproducible, no provider quota. About 15 grounding cases plus prompt regression. GitHub Actions runs this in the normal Playwright workflow. A pass does **not** prove a hosted LLM cannot hallucinate. A fail **does** block that CI job.

`npm run test:llm` always forces `CRYPTO_ANALYST_EVAL_PROVIDER=deterministic`, even if a live provider is set in `.env`.

## B. Live provider benchmarking (optional)

Same 10 questions and market contexts as fixture Layer 2 (`semantic-grounding-live-v1`). Each case calls production `analyzeCryptoQuery()` (which uses production `buildCryptoSystemPrompt()`). Only the analyst provider/model should change between runs. The judge is independent.

```bash
CRYPTO_ANALYST_EVAL_PROVIDER=claude \
LLM_EVAL_JUDGE_PROVIDER=openrouter \
LLM_EVAL_JUDGE_MODEL=nvidia/nemotron-3-super-120b-a12b:free \
npm run test:llm:live-grounding
```

Repeat with `CRYPTO_ANALYST_EVAL_PROVIDER=gemini` (or openai, groq, deepseek, openrouter) and the **same** judge settings. The repo does not rank providers or declare a winner.

Output:

- Promptfoo: `evals/.output/live-grounding-latest.json`
- Summary (analyst vs judge, dataset, per-case status, aggregates): `evals/.output/live-grounding-summary.json`

If analyst or judge is unconfigured, the command prints `LLM_EVAL_STATUS=SKIPPED` and exits `2`. That is not a pass. Quota/rate-limit failures are errors, not passes.

This command is **not** in the deployment workflow. Optional GitHub Action: **LLM Provider Evaluation** (`workflow_dispatch`).

Prefer a judge provider different from the analyst when practical. Same-provider judge is allowed but not recommended.

## C. Prompt injection / robustness (separate)

```bash
npm run test:llm:injection
```

Keyless deterministic heuristics, then optional semantic fixtures if a judge is configured. Not a provider benchmark. Not a deployment gate. A passing run does **not** mean the app is immune to prompt injection.

## D. Local Ollama judge (optional)

No API key and no cloud judge quota:

```bash
LLM_EVAL_JUDGE_PROVIDER=ollama \
LLM_EVAL_JUDGE_MODEL=llama3.2 \
OLLAMA_HOST=http://127.0.0.1:11434 \
CRYPTO_ANALYST_EVAL_PROVIDER=claude \
npm run test:llm:live-grounding
```

Ollama is not required. If you select `ollama` but the daemon is down or the model is missing, the judge call errors (not PASS). GitHub-hosted eval workflows use a cloud judge, not Ollama.

### Fixture Layer 2 (unchanged)

```bash
npm run test:llm:semantic
```

Grades canned answers with the same semantic judge. Requires `LLM_EVAL_JUDGE_PROVIDER` (`claude` | `openai` | `gemini` | `groq` | `deepseek` | `openrouter` | `ollama`) and a key except for Ollama.

OpenRouter judge default remains `nvidia/nemotron-3-super-120b-a12b:free`. Do not use `openrouter/free` for reproducible evals (it is a router). Free-tier daily `429` is an error, not a pass.
