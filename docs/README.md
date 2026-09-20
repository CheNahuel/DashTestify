# Playwright reporting docs

Professional GitHub Actions reporting for Playwright tests using **artifacts**, PR comments, and JUnit check publishing.

> **Note:** GitHub Pages deployment was removed. HTML reports are uploaded as Actions artifacts per run. Older Pages-era write-ups live in [archive/](./archive/).

## Start here

| Doc                                                              | Purpose                          |
| ---------------------------------------------------------------- | -------------------------------- |
| [QUICK_START.md](./QUICK_START.md)                               | Get reports working fast         |
| [ARTIFACT_BASED_REPORTING.md](./ARTIFACT_BASED_REPORTING.md)     | How artifact reports work        |
| [WORKFLOW_REFERENCE.md](./WORKFLOW_REFERENCE.md)                 | Workflow steps reference         |
| [PLAYWRIGHT_SETUP_CHECKLIST.md](./PLAYWRIGHT_SETUP_CHECKLIST.md) | Setup checklist                  |
| [DATABASE_SETUP.md](./DATABASE_SETUP.md)                         | Supabase metrics tables          |
| [CRYPTO_AI_ANALYST.md](./CRYPTO_AI_ANALYST.md)                   | Floating crypto market assistant |

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

| Route                  | Purpose                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `/`                    | Crypto dashboard with Mock/Live data and the floating Crypto AI Analyst in Live mode |
| `/quality-analytics`   | Historical metrics (Supabase)                                                        |
| `/ai-failure-analysis` | Local AI analysis + run tests (development only)                                     |

The application uses Next.js route groups under `src/app/(dashboard)` and
`src/app/(qa)`; the parentheses are organizational and do not appear in URLs.

Local QA APIs that run tests or apply AI patches are guarded and return `403`
outside development. See [CRYPTO_AI_ANALYST.md](./CRYPTO_AI_ANALYST.md) for the
separate market-analysis assistant flow.
