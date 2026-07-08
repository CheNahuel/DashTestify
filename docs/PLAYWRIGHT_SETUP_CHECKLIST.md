# Playwright Reporting Setup Checklist

Complete this checklist to enable the full reporting experience.

## Code Changes ✅

- [x] **playwright.config.ts** — Added JUnit reporter
- [x] **scripts/parse-test-results.js** — Created test results parser
- [x] **.github/workflows/playwright.yml** — Updated with new steps and deploy job
- [x] **docs/PLAYWRIGHT_REPORTING.md** — Documentation

## Repository Settings ⚙️

### GitHub Pages Setup

- [ ] Go to **Settings → Pages**
- [ ] Set **Source** to: **Deploy from a branch**
- [ ] Select **gh-pages** branch
- [ ] Click **Save**
- [ ] Wait ~1-2 minutes for initial setup
- [ ] Verify Pages deployment in **Settings → Pages → Visit site**

### Verify Permissions

- [ ] Check **Settings → Actions → General → Workflow permissions**
- [ ] Ensure **"Read and write permissions"** is selected
- [ ] Or use custom permissions defined in the workflow

## First Test Run

1. [ ] Push code to `main` branch
2. [ ] Wait for workflow to complete
3. [ ] Check **Actions → Latest run → Summary**
   - [ ] Job summary appears at top
   - [ ] Test metrics display correctly
4. [ ] Check **Settings → Pages**
   - [ ] Deployment shows success
   - [ ] URL is displayed
5. [ ] Visit GitHub Pages URL: `https://{owner}.github.io/{repo}/`
   - [ ] HTML report loads
   - [ ] Navigation works
   - [ ] Test details visible

## Pull Request Test (Optional)

1. [ ] Create a test PR
2. [ ] Wait for workflow to complete
3. [ ] Check **PR → Checks tab**
   - [ ] "Playwright Test Results" check appears
   - [ ] Failed tests listed (if any)
4. [ ] Check **PR → Conversation tab**
   - [ ] Sticky comment with test summary
   - [ ] Links are clickable

## Verification Commands

Run these locally to verify setup:

```bash
# Check Playwright config
npm list --depth=0 @playwright/test

# Verify parser script works
node scripts/parse-test-results.js

# Run tests locally
npm run test:e2e

# Check generated files
ls -la test-results/
ls -la playwright-report/
```

## Common Issues

| Issue | Solution |
|-------|----------|
| GitHub Pages shows "404" | Verify Pages is enabled in Settings |
| No test results in summary | Check if `results.json` exists in test-results/ |
| PR comment not appearing | Verify workflow permissions include `pull-requests: write` |
| Pages deployment fails | Check branch protection rules on `gh-pages` |

## Documentation

- [ ] Read [PLAYWRIGHT_REPORTING.md](./PLAYWRIGHT_REPORTING.md) for detailed info
- [ ] Share with team
- [ ] Update team wiki/docs

## Next Steps

Once verified, consider:
1. Adding Slack notifications for test failures
2. Setting up performance budgets
3. Creating dashboards for test trends
4. Integrating with project management tools

---

**Questions?** Check the documentation or GitHub Actions logs for detailed error messages.
