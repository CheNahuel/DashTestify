# Playwright Reporting Quick Start

Get the professional Playwright reporting system running in 5 minutes.

## What You Get

After setup, every test run will automatically:

✅ **Display test results** at the top of your workflow run (GitHub Actions Job Summary)  
✅ **Publish to GitHub Pages** so reviewers can view the HTML report directly  
✅ **Comment on PRs** with test metrics (sticky comment, updates automatically)  
✅ **Show failed tests** in GitHub's native test interface (PR Checks tab)  
✅ **Keep artifacts** for 30 days as backup  

## Setup (3 Steps)

### Step 1: Enable GitHub Pages

1. Go to your repository **Settings**
2. Click **Pages** in the left sidebar
3. Under "Build and deployment":
   - **Source:** Select "Deploy from a branch"
   - **Branch:** Select `gh-pages` / `root`
4. Click **Save**
5. Wait 1-2 minutes

Done! GitHub will automatically create the `gh-pages` branch when the workflow runs.

### Step 2: Deploy Code

All the code is already in place:

```bash
# View changes
git status

# You should see:
# - playwright.config.ts (modified)
# - .github/workflows/playwright.yml (modified)
# - scripts/parse-test-results.js (new)
# - docs/PLAYWRIGHT_REPORTING.md (new)
# - docs/PLAYWRIGHT_SETUP_CHECKLIST.md (new)
# - PLAYWRIGHT_CHANGES_SUMMARY.md (new)

# Commit and push
git add .
git commit -m "feat: add comprehensive Playwright reporting to GitHub Actions

- Add JUnit reporter for native test result publishing
- Deploy HTML report to GitHub Pages after each test run
- Add sticky PR comments with test metrics
- Add GitHub Actions job summary with test results and links
- Create test results parser script for consistent data extraction

Enables:
- View HTML reports directly via GitHub Pages URL
- See test results in PR checks tab
- Receive automatic PR comments with test summary
- Professional test reporting comparable to mature QA teams"

git push
```

### Step 3: Verify Setup

1. **Push to main branch** (or wait for next main push)
2. Go to **Actions** tab → Latest run
3. Look for:
   - ✅ **Job Summary** at top (test metrics table)
   - ✅ **Artifact** named `playwright-report-{run_id}`
4. Check **Settings → Pages**:
   - Should show successful deployment
   - URL: `https://{username}.github.io/{repo}/`
5. Visit the GitHub Pages URL
   - Should see interactive HTML report

🎉 **Setup complete!**

---

## Using the Reports

### View Test Results on Main Branch

**In GitHub Actions:**
1. Go to **Actions** tab
2. Click latest workflow run
3. Scroll to **Summary** section at top
4. See test metrics and links

**In Browser (GitHub Pages):**
1. Visit: `https://{username}.github.io/{repo}/`
2. See interactive HTML report
3. Drill into test details, traces, screenshots, videos

### View Test Results in Pull Requests

**In PR Checks Tab:**
1. Create a test PR
2. Go to **Checks** tab
3. Click **Playwright Test Results**
4. See failed tests with details

**In PR Comments:**
1. Go to **Conversation** tab
2. Scroll down
3. See sticky bot comment with:
   - Test summary (passed, failed, skipped, duration)
   - Links to reports and Actions run
4. Comment updates automatically on each run

---

## What Each Feature Does

### 🎯 GitHub Actions Job Summary

**Where:** Top of workflow run  
**Shows:** Test metrics in a table  
**Visible to:** Everyone with repository access  

```
✅ Playwright Test Results

| Metric | Value |
|--------|-------|
| Passed | 42 |
| Failed | 0 |
| Skipped | 2 |
| Duration | 45s |

📦 Artifacts
- Artifact Name: playwright-report-123456
- Retention: 30 days

📄 Reports
- [View HTML Report (GitHub Actions)]
- [GitHub Pages Report]
```

### 🌐 GitHub Pages Deployment

**Where:** Public URL  
**Shows:** Interactive HTML test report  
**Access:** `https://{username}.github.io/{repo}/`  
**Retention:** Forever (auto-updates on each run)  

The same report you see with `playwright show-report` locally, but viewable in the browser without downloads.

### 💬 PR Comments

**Where:** PR conversation tab  
**Shows:** Test summary + links  
**Updates:** Automatically (sticky comment, no duplicates)  

Only appears on PR events. Provides quick feedback without leaving the PR.

### 🧪 Unit Test Results (PR Checks)

**Where:** PR Checks tab  
**Shows:** Failed tests with stack traces  
**Visibility:** Only if tests failed  

Native GitHub integration shows failed test details directly in the PR.

### 📦 Artifacts

**Where:** Actions → Artifacts  
**Contains:** Full test data (screenshots, videos, traces)  
**Retention:** 30 days  
**Backup:** In case GitHub Pages fails  

---

## Troubleshooting

### GitHub Pages shows "404"

**Check:**
1. Settings → Pages — Is it enabled?
2. Actions tab — Did the deployment complete?

**Fix:**
```bash
# Force a new run
git commit --allow-empty -m "Trigger workflow"
git push
```

### No summary appears at top of workflow

**Check:**
1. Did tests actually run? (scroll down to see test step)
2. Does `test-results/results.json` exist?

**Debug locally:**
```bash
npm run test:e2e
node scripts/parse-test-results.js
```

### PR comment not appearing

**Check:**
1. Is this a PR event? (not main branch push)
2. Did the workflow complete successfully?

**Verify:**
- Check workflow logs for "Comment on Pull Request" step
- Look for error messages in that step

### Test results show 0 tests

**Check:**
1. Did Playwright actually find tests?
2. Run tests locally: `npm run test:e2e`
3. Check that `tests/` directory exists with test files

---

## Next Steps

### 1. Configure for Your Team

- **Share the docs:** Team should read `PLAYWRIGHT_REPORTING.md`
- **Set expectations:** Test results now public in GitHub Pages
- **Integrate:** Point team to PR comments for feedback

### 2. Optional Enhancements

Consider adding:
- Slack notifications for test failures
- Performance budgets (fail if tests are too slow)
- Trend dashboards (track pass rate over time)
- Flaky test detection

### 3. Team Onboarding

Share with your team:
- `docs/PLAYWRIGHT_REPORTING.md` — How it works
- `docs/PLAYWRIGHT_SETUP_CHECKLIST.md` — Verification steps
- This file — Quick start guide

---

## Reference

| Item | Location |
|------|----------|
| **Full Docs** | `docs/PLAYWRIGHT_REPORTING.md` |
| **Setup Help** | `docs/PLAYWRIGHT_SETUP_CHECKLIST.md` |
| **Workflow Details** | `docs/WORKFLOW_REFERENCE.md` |
| **Change Summary** | `PLAYWRIGHT_CHANGES_SUMMARY.md` |
| **Workflow File** | `.github/workflows/playwright.yml` |
| **Config** | `playwright.config.ts` |
| **Parser Script** | `scripts/parse-test-results.js` |

---

## Common Questions

**Q: Will this slow down my workflow?**  
A: ~15-20 seconds additional time. Negligible compared to test execution.

**Q: Does GitHub Pages cost anything?**  
A: No. Free for all repositories (public and private with GitHub Pro).

**Q: Can I disable certain features?**  
A: Yes. See `PLAYWRIGHT_CHANGES_SUMMARY.md` for customization options.

**Q: What if I don't want public reports?**  
A: Disable the Pages deployment step and rely on artifacts instead.

**Q: Can I customize the PR comment?**  
A: Yes. Edit the comment body template in the workflow file.

---

## Need Help?

1. Check the **Troubleshooting** section above
2. Read `docs/PLAYWRIGHT_REPORTING.md` for detailed info
3. Check workflow logs in GitHub Actions for errors
4. Verify GitHub Pages settings are correct

---

**Status:** ✅ Ready to use

**Time to setup:** ~5 minutes  
**Time to verify:** ~2-3 minutes after first workflow run  
**Total:** ~10 minutes for full setup and verification
