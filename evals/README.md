# Crypto AI Analyst LLM evals

Promptfoo owns LLM/prompt regression. Playwright remains UI and end-to-end testing.

Roles must stay distinct:

- **Supplied market context** — source of truth (`vars.context`)
- **User question** — what was asked (`vars.query`); not evidence
- **Generated answer** — text under evaluation
- **Evaluator / judge** — Layer 2 only; not the Crypto AI Analyst

These layers are additive. Semantic evaluation must not replace the deterministic suite.

### 1. Deterministic grounding (CI, default)

Structural/heuristic checks:

- Known supported values are present when expected (for example the BTC price in the fixture context).
- Obvious unsupported market-stat patterns are flagged (denylisted strings; market cap / 24h / volume phrasing plus a number not in context).

Properties: deterministic, fast, no API key, suitable for CI.

Limits: this is **not** a complete hallucination detector. Paraphrased unsupported claims without a matching numeric or market-stat pattern will not be caught.

```bash
npm run test:llm
```

That command also runs **prompt regression** (keyless): the production `buildCryptoSystemPrompt` still contains grounding rules and embeds the fixture BTC/ETH context. No API key. Not a hallucination detector.

A passing Layer 1 run is **not** proof that a hosted LLM cannot hallucinate.

### 2. Semantic grounding / LLM-as-a-judge (opt-in)

Detects unsupported factual market claims even when paraphrased. Reuses the same grounding context and question as Layer 1, with fixture generated answers (including a numeric unsupported market-cap claim and a paraphrased comparison).

The judge is configured only via environment variables. It does not use production `analyzeCryptoQuery` or Promptfoo's built-in OpenAI provider in yaml.

```bash
npm run test:llm:semantic
```

Required:

- `LLM_EVAL_JUDGE_PROVIDER` — `claude` | `openai` | `gemini` | `groq` | `deepseek` | `openrouter`
- Matching API key (`CLAUDE_API_KEY` / `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …)

Optional:

- `LLM_EVAL_JUDGE_MODEL`
- `LLM_EVAL_JUDGE_THRESHOLD` — pass threshold in `[0, 1]`, default `0.7`

If the evaluator is not configured, this command prints `LLM_EVAL_STATUS=SKIPPED` and exits `2`. It does not report a pass.

Do not add Layer 2 to default CI until a judge key is intentionally provisioned.

### 3. Live analyst grounding (opt-in)

Calls production `analyzeCryptoQuery` with the same fixture context and question as Layer 1, then grades the **live** answer with the existing semantic judge. Analyst and judge providers are separate env vars.

```bash
npm run test:llm:live-grounding
```

Required:

- `CRYPTO_ANALYST_EVAL_PROVIDER` — live analyst (`claude` | `openai` | `gemini` | `groq` | `deepseek` | `openrouter`), not `deterministic`
- Matching analyst API key
- `LLM_EVAL_JUDGE_PROVIDER` and matching judge API key (same as Layer 2)

`npm run test:llm` always forces `CRYPTO_ANALYST_EVAL_PROVIDER=deterministic` so Layer 1 stays keyless even if a live provider is set in `.env`.

If analyst or judge is not configured, this command prints `LLM_EVAL_STATUS=SKIPPED` and exits `2`. A live model that invents unsupported market facts will fail the judge; the suite is not tuned to force a pass.

