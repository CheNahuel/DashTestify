# Playwright reporting — quick start

This project uploads Playwright HTML reports as **GitHub Actions artifacts**. There is no GitHub Pages deploy step.

## What you get on every run

- ✅ Playwright E2E results
- ✅ JUnit check published in the PR Checks UI
- ✅ Sticky PR comment: **Playwright Test Results**
- ✅ Artifact: `playwright-report-{run_id}` (download ZIP → open `index.html`)
- ✅ Optional upload to Supabase for `/quality-analytics`

## How to view a report

1. Open the repo **Actions** tab
2. Open the workflow run
3. Scroll to **Artifacts**
4. Download `playwright-report-{run_id}`
5. Extract and open `playwright-report/index.html`

## PR comment

Each PR gets one sticky bot comment titled **Playwright Test Results** with pass/fail counts and a link to the artifact.

## Local commands

```bash
npm run test:e2e
npm run test:e2e:report
```

## App routes

| Route | When |
|-------|------|
| `/quality-analytics` | Metrics from Supabase (local or production) |
| `/ai-failure-analysis` | AI failure analysis — **development only** |

## More detail

- [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md)
- [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md)
- [archive/](./archive/) — historical Pages/deploy notes (not active)
