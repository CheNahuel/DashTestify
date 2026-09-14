# Workflow reference (Playwright)

Current workflow: `.github/workflows/playwright.yml`

Reports are delivered as **GitHub Actions artifacts**, not GitHub Pages.

## Permissions

```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
  actions: read
```

No `pages: write` / `id-token: write` are required.

## Main steps

1. Checkout + install dependencies
2. Run Playwright (`npm run test:e2e`)
3. Parse JSON results (`scripts/parse-test-results.js`)
4. Upload HTML report artifact: `playwright-report-{run_id}`
5. Publish JUnit check (`Playwright Test Results`)
6. Sticky PR comment matching `Playwright Test Results`
7. Optional Supabase upload (`npm run upload:test-results`)

## Viewing the HTML report

Actions → run → Artifacts → download `playwright-report-{run_id}` → open `playwright-report/index.html`

## Related docs

- [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md)
- [QUICK_START.md](./QUICK_START.md)
- [archive/](./archive/) — historical Pages notes only
