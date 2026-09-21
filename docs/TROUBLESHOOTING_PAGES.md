# Troubleshooting Playwright reports

GitHub Pages deployment was removed. Reports are **Actions artifacts**.

## Artifact missing

1. Open the workflow run → confirm the Playwright job finished
2. Confirm the step **Upload Playwright HTML report** ran
3. Confirm `playwright-report/` existed after the test step
4. Re-run the workflow if the upload was skipped due to a path mismatch

## PR comment duplicated

The sticky comment matcher must match the body title exactly:

- Body starts with `## … Playwright Test Results`
- Lookup uses `comment.body.includes('Playwright Test Results')`

If those strings diverge, GitHub creates a new comment every run.

## Metrics page empty / error

`/quality-analytics` needs Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
```

Without a working config, the UI shows an error alert (`supabase-config-error`).

## AI failure analysis unavailable in production

`/ai-failure-analysis` and the local APIs (`/api/quality-analytics/run-tests`, `/api/quality-analytics/local-ai`) are development-only and return redirect/403 when deployed.

## Crypto AI Analyst unavailable

The floating Crypto AI Analyst is intentionally rendered only when the dashboard
has live data available. Check that `COINCAP_API_KEY` is configured or that the
selected `DATA_SOURCE` is available, then restart `npm run dev`. The provider
selector shows which AI providers have configured keys; missing provider keys
remain visible but cannot be selected.

For request, response formatting, and source-citation behavior, see
[CRYPTO_AI_ANALYST.md](./CRYPTO_AI_ANALYST.md).

## Historical Pages notes

Older Pages-era debugging write-ups are kept under [archive/](./archive/) for reference only.
