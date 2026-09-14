# Playwright reporting docs

Professional GitHub Actions reporting for Playwright tests using **artifacts**, PR comments, and JUnit check publishing.

> **Note:** GitHub Pages deployment was removed. HTML reports are uploaded as Actions artifacts per run. Older Pages-era write-ups live in [archive/](./archive/).

## Start here

| Doc | Purpose |
|-----|---------|
| [QUICK_START.md](./QUICK_START.md) | Get reports working fast |
| [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md) | How artifact reports work |
| [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md) | Workflow steps reference |
| [PLAYWRIGHT_SETUP_CHECKLIST.md](./PLAYWRIGHT_SETUP_CHECKLIST.md) | Setup checklist |
| [DATABASE_SETUP.md](./DATABASE_SETUP.md) | Supabase metrics tables |

## What the workflow does

1. Runs Playwright on push / PR / schedule
2. Publishes JUnit results to the Checks UI
3. Comments a sticky summary on PRs (`Playwright Test Results`)
4. Uploads `playwright-report-{run_id}` as a downloadable artifact
5. Optionally uploads results to Supabase for `/quality-analytics`

## Viewing an HTML report

1. Open the workflow run in **Actions**
2. Download the `playwright-report-{run_id}` artifact
3. Extract the ZIP and open `playwright-report/index.html`

## Related app routes

| Route | Purpose |
|-------|---------|
| `/quality-analytics` | Historical metrics (Supabase) |
| `/ai-failure-analysis` | Local AI analysis + run tests (development only) |
