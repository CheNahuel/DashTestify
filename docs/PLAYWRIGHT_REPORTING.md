# Playwright Reporting Setup

This document explains the Playwright reporting system used by `.github/workflows/playwright.yml`.

## Overview

The workflow provides:

1. **Pull Request Comments** — sticky summary titled **Playwright Test Results**
2. **Unit Test Results** — JUnit results in GitHub's Checks UI
3. **Artifacts** — downloadable `playwright-report-{run_id}` ZIP with the full HTML report
4. **Optional Supabase upload** — feeds historical metrics on `/quality-analytics`

> GitHub Pages is **not** used. Older Pages-era notes are in [archive/](./archive/).  
> Quick path: [QUICK_START.md](./QUICK_START.md) · deeper artifact notes: [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md)

## Playwright configuration (`playwright.config.ts`)

```typescript
reporter: [
  ['html', { open: 'never' }],
  ['json', { outputFile: 'test-results/results.json' }],
  ['junit', { outputFile: 'test-results/junit.xml' }]
],
```

- **HTML** → uploaded as the Actions artifact
- **JSON** → parsed by `scripts/parse-test-results.js` for the PR comment
- **JUnit** → published into the Checks UI

## Test results parser (`scripts/parse-test-results.js`)

Reads `test-results/results.json` and writes a compact summary (`passed`, `failed`, `skipped`, `duration`) used by the PR comment step.

## Workflow permissions (`.github/workflows/playwright.yml`)

```yaml
permissions:
  contents: read           # Checkout
  checks: write            # Publish JUnit / check runs
  pull-requests: write     # Sticky PR comments
```

No `pages: write` or `id-token: write` — Pages deployment was removed.

## Workflow steps (high level)

| Step | Purpose |
|------|---------|
| Lint + build + `npm run test:e2e` | Quality gate |
| Parse test results | Build `test-summary.json` |
| Upload Playwright report as artifact | `playwright-report-{run_id}` (30-day retention) |
| Publish Unit Test Results | JUnit → Checks UI (`Playwright Test Results`) |
| Comment on Pull Request | Sticky bot comment with counts + artifact link |
| Upload test results to Supabase | Optional metrics for `/quality-analytics` |

## How It Works

### On push to `main`

1. Tests run on `ubuntu-24.04`
2. HTML report is uploaded as `playwright-report-{run_id}`
3. JUnit results are published to Checks
4. Results may upload to Supabase (if secrets are set)

### On pull request targeting `main`

Same as above, plus:

1. Bot upserts a sticky PR comment titled **Playwright Test Results**
2. Matcher looks for `Playwright Test Results` in existing bot comments (must match the body title or duplicates appear)
3. Comment links to the downloadable artifact for that run

### Artifact retention

- Default: **30 days** (`retention-days: 30` on `actions/upload-artifact@v4`)
- Each run keeps its own ZIP; later runs do not overwrite earlier ones

## Accessing test reports

### From a PR

1. Open the PR → Checks / conversation
2. Read the sticky **Playwright Test Results** comment
3. Follow the artifact download link (or Actions → run → Artifacts)

### From Actions

1. **Actions** → workflow run
2. Scroll to **Artifacts**
3. Download `playwright-report-{run_id}`
4. Extract and open `playwright-report/index.html`

### Locally

```bash
npm run test:e2e
npm run test:e2e:report
```

## Troubleshooting

### Artifact missing / empty

1. Confirm the Playwright job finished (`if: always()` still runs upload)
2. Confirm `playwright-report/` exists after the test step
3. Check upload step logs for `if-no-files-found: warn`

### "No test results found" / empty summary

```bash
ls test-results
node scripts/parse-test-results.js
```

Ensure the JSON reporter wrote `test-results/results.json`.

### PR comment not appearing

- Job must run on `pull_request`
- Token needs `pull-requests: write`
- Check the Comment on Pull Request step logs

### Duplicate PR comments

The sticky updater must match the body title:

- Body: `## … Playwright Test Results`
- Lookup: `comment.body.includes('Playwright Test Results')`

If those strings diverge, every run creates a new comment.

### Metrics page empty / error (`/quality-analytics`)

Needs Supabase secrets / env (`SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_*`). Without them the UI shows `supabase-config-error`.

### AI failure analysis in production

`/ai-failure-analysis` and local APIs (`run-tests`, `local-ai`) are development-only; deployed environments redirect/403.

More detail: [TROUBLESHOOTING_PAGES.md](./TROUBLESHOOTING_PAGES.md).

## Performance Impact

| Piece | Impact |
|-------|--------|
| Playwright suite (`workers: 1`) | Dominates job time (often minutes) |
| Lint + Next build | Extra CI minutes before tests |
| Artifact upload | Small; HTML report size depends on traces/screenshots/videos |
| Parser / PR comment | Negligible |

Timeout budget: job `timeout-minutes: 20`.

## Cost Implications

### GitHub Actions

- Billed by runner minutes (lint + build + Playwright)
- Artifact storage counts toward Actions storage; 30-day retention limits growth

### Artifacts vs Pages

- Artifacts: no Pages bandwidth/config; private to repo permissions
- Pages (removed): public URL hosting was optional complexity we dropped

## Security Considerations

### Permissions

Least privilege for the current flow: `contents: read`, `checks: write`, `pull-requests: write`.

### Secrets

- Supabase keys only used when configured; never commit `.env`
- Local QA APIs that spawn tests or apply patches are blocked outside development

### Sticky comments

Bot comments use `GITHUB_TOKEN`. Only bot comments containing **Playwright Test Results** are updated.

## Future Enhancements

- Parallel Playwright workers once tests are isolation-safe
- Richer job summary (`GITHUB_STEP_SUMMARY`) next to the artifact link
- Shorter/longer artifact retention by environment
- Stronger auth around any remaining sensitive analytics routes

## References

- Workflow: `.github/workflows/playwright.yml`
- [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md)
- [QUICK_START.md](./QUICK_START.md)
- [PLAYWRIGHT_SETUP_CHECKLIST.md](./PLAYWRIGHT_SETUP_CHECKLIST.md)
- [archive/](./archive/) — historical Pages/deploy write-ups
