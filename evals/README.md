# Crypto AI Analyst LLM evals

Promptfoo owns LLM/prompt regression. Playwright remains UI and end-to-end testing.

Roles must stay distinct:

- **Supplied market context** — source of truth (`vars.context`)
- **User question** — what was asked (`vars.query`); not evidence
- **Generated answer** — text under evaluation
- **Evaluator / judge** — Layer 2 only; not the Crypto AI Analyst

These layers are additive. Semantic evaluation must not replace the deterministic suite.

### 1. Deterministic grounding (CI, default)

Structural/heuristic checks on about 15 fixture cases:

- Grounding, accuracy, calculations, temporal correctness, relevance, and formatting
- Deterministic assertions where structure is enough (prices, 15%, $110,800, no Markdown tables)
- Semantic LLM-as-a-judge (Layer 2) where meaning or paraphrase matters

They detect different failure classes. A passing Layer 1 run is **not** proof that a hosted LLM cannot hallucinate.

Properties: deterministic, fast, no API key, suitable for CI.

Limits: this is **not** a complete hallucination detector. Paraphrased unsupported claims without a matching numeric or market-stat pattern will not be caught.

```bash
npm run test:llm
```

That command also runs **prompt regression** (keyless): the production `buildCryptoSystemPrompt` still contains grounding rules and embeds the fixture BTC/ETH context. No API key. Not a hallucination detector.

A passing Layer 1 run is **not** proof that a hosted LLM cannot hallucinate.

### 2. Semantic grounding / LLM-as-a-judge (opt-in)

Detects unsupported factual market claims even when paraphrased. Covers the regression cases marked `semantic` or `both` (including invented market cap, paraphrased cap comparison, and treating current price as yesterday). Fixture answers are graded; this is not live CoinCap/Supabase data.

The judge is configured only via environment variables. It does not use production `analyzeCryptoQuery` or Promptfoo's built-in OpenAI provider in yaml.

```bash
npm run test:llm:semantic
```

Required:

- `LLM_EVAL_JUDGE_PROVIDER` — `claude` | `openai` | `gemini` | `groq` | `deepseek` | `openrouter`
- Matching API key (`CLAUDE_API_KEY` / `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …)

The judge client requests JSON-object output from providers that support it (`response_format: json_object` for OpenAI, Groq, DeepSeek, and OpenRouter; `responseMimeType: application/json` for Gemini). OpenRouter also sets `provider.require_parameters: true` so the request is not silently routed to an endpoint that ignores JSON mode. Malformed judge output fails the case; it is never treated as a pass.

Optional:

- `LLM_EVAL_JUDGE_MODEL` — judge model id. This is the only way to override the eval-only default. It does not change production `OPENROUTER_MODEL` / Crypto AI Analyst.
- `LLM_EVAL_JUDGE_THRESHOLD` — pass threshold in `[0, 1]`, default `0.7`

**Reproducible OpenRouter configuration (recommended):**

```bash
LLM_EVAL_JUDGE_PROVIDER=openrouter
LLM_EVAL_JUDGE_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_API_KEY=...
```

`nvidia/nemotron-3-super-120b-a12b:free` is the eval-only OpenRouter default. It is a **specific model** (not the `openrouter/free` router), advertises `response_format` / structured outputs on OpenRouter, and is large enough to use as an LLM-as-a-judge on a free-tier OpenRouter key.

If the OpenRouter account has credits, `openai/gpt-4o-mini` is a stronger paid alternative (`LLM_EVAL_JUDGE_MODEL=openai/gpt-4o-mini`). It is not the default here because a creditless OpenRouter key returns HTTP 402 for that model.

Layer 2 still requires the matching API key and is **not** part of default `npm run test:llm` / GitHub Actions.

`openrouter/free` remains usable for experimentation:

```bash
LLM_EVAL_JUDGE_MODEL=openrouter/free
```

Do **not** use `openrouter/free` for deterministic CI. It is a router: each request can land on a different free model, and some of those models return empty `content` or ignore JSON contracts.

If the evaluator is not configured, this command prints `LLM_EVAL_STATUS=SKIPPED` and exits `2`. It does not report a pass.

Do not add Layer 2 to default CI until a judge key **and** a pinned `LLM_EVAL_JUDGE_MODEL` are intentionally provisioned.

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

### 4. Prompt injection / adversarial (separate suite)

Tests instruction hierarchy: whether answers stay grounded in **supplied market context** when the **user message** tries to override system rules.

This is different from Layer 1/2 grounding. Grounding asks a normal market question. Injection asks a malicious user to ignore context, invent missing stats, accept poisoned numbers, or dump hidden instructions.

Attack types in `evals/datasets/prompt-injection.json` (10 cases):

1. Direct instruction override
2. Explicit grounding bypass
3. Fake authority / fake system update
4. Role manipulation
5. Context poisoning (user-stated facts that are not in `vars.context`)
6. Instruction extraction
7. Multi-instruction combination
8. Historical data bypass
9. Unsupported calculation from an injected assumption
10. Indirect instruction embedded in the question

Deterministic checks are keyless heuristics (no invented `$2.5T`, unavailable when the fact is missing, no distinctive system-prompt fingerprint). They do **not** require wording such as "I cannot comply." Answering a **supported** fact from context can still be correct.

Semantic evaluation uses a separate adversarial rubric on fixture answers (`evals/datasets/prompt-injection-semantic.json`) and the existing eval-only judge client. It grades behavior (invented facts, treating user text as system/context, leaking instructions), not refusal style.

```bash
npm run test:llm:injection
```

Always runs the 10 deterministic cases. If `LLM_EVAL_JUDGE_PROVIDER` and the matching key are set, it then runs the 10 semantic injection cases. If the judge is not configured, it prints `LLM_EVAL_SEMANTIC_INJECTION=SKIPPED` (not a semantic pass) and exits `0` after a successful deterministic run.

Not part of `npm run test:llm` or default GitHub Actions. A passing injection suite does **not** mean the application is secure or immune to prompt injection. It is a small regression sample.

OpenRouter free-tier daily limits (`429 free-models-per-day`) fail the semantic injection run as errors, not passes. They are a provider quota issue, not evidence that the attacks succeeded.

Do not add the semantic injection suite to default CI until a judge key and pinned `LLM_EVAL_JUDGE_MODEL` are intentionally provisioned.

