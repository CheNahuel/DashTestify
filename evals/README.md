# Crypto AI Analyst LLM evals

Promptfoo owns LLM/prompt regression. Playwright remains UI and end-to-end testing.

## Evaluation layers

These layers are additive. Semantic evaluation must not replace the deterministic suite.

### 1. Deterministic grounding (v1, CI)

Structural/heuristic checks:

- Known supported values are present when expected (for example the BTC price in the fixture context).
- Obvious unsupported market-stat patterns are flagged (denylisted strings; market cap / 24h / volume phrasing plus a number not in context).

Properties: deterministic, fast, no API key, suitable for CI.

Limits: this is **not** a complete hallucination detector. Paraphrased unsupported claims without a matching numeric or market-stat pattern will not be caught.

### 2. Semantic grounding (not implemented)

Detect unsupported claims even when they are paraphrased or lack an exact numeric pattern. Requires an LLM-as-a-judge or another semantic evaluator. Same datasets and provider adapter; extra assert types later (for example `npm run test:llm:live`).

A passing v1 run is **not** proof that a hosted LLM cannot hallucinate. The default provider is a keyless deterministic completer that uses the production system prompt builder but does not call an external model.

## Run

```bash
npm run test:llm
```
