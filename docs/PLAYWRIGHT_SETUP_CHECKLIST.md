# Playwright setup checklist

## Repository

- [ ] Workflow present: `.github/workflows/playwright.yml`
- [ ] Secrets for Supabase upload (optional): `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] CoinCap key only needed for live crypto tests (`test:e2e:live`)

## Verify a run

1. [ ] Push a branch / open a PR
2. [ ] Actions run completes
3. [ ] Artifact `playwright-report-{run_id}` is listed
4. [ ] PR has a sticky comment titled **Playwright Test Results**
5. [ ] JUnit check appears in the Checks UI

## Local

```bash
npm install
npm run test:e2e
npm run test:e2e:report
```

## App QA routes

- [ ] `/` — crypto dashboard and floating Crypto AI Analyst in Live mode
- [ ] `/quality-analytics` — metrics (needs Supabase for real data)
- [ ] `/ai-failure-analysis` — local AI tools only (blocked in production)

## Crypto AI Analyst checks

- [ ] Provider status loads and configured providers are selectable
- [ ] Suggested question and manual query flows return mocked responses in E2E tests
- [ ] Conversation state persists after closing and reopening the floating panel
- [ ] Error/Dismiss behavior restores the default suggested questions

## Troubleshooting

See [TROUBLESHOOTING_PAGES.md](./TROUBLESHOOTING_PAGES.md) (artifact-focused; Pages notes archived).
