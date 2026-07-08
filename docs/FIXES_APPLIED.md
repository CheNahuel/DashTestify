# Fixes Applied to Playwright Reporting

## Issues Found

From analyzing your workflow logs, I identified three main problems:

### 1. ❌ Parser Returning All Zeros

**Symptom:** Tests passed (103 passed) but test summary showed:
```json
{
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "total": 0
}
```

**Root Cause:** The Playwright JSON format has nested `suites` that may contain their own `suites`. The parser wasn't recursively processing nested suites.

**Example Playwright JSON structure:**
```json
{
  "suites": [
    {
      "title": "Tests",
      "suites": [
        {
          "tests": [
            { "status": "passed", "duration": 1500 }
          ]
        }
      ]
    }
  ]
}
```

**Fix:** Updated parser to recursively process nested suites
```javascript
function processSuite(s) {
  if (s.tests && Array.isArray(s.tests)) {
    s.tests.forEach(test => {
      totalDuration += test.duration || 0;
      if (test.status === 'passed') passed++;
      else if (test.status === 'failed') failed++;
      else if (test.status === 'skipped') skipped++;
    });
  }
  // Handle nested suites
  if (s.suites && Array.isArray(s.suites)) {
    s.suites.forEach(nested => processSuite(nested));
  }
}
```

---

### 2. ❌ Deploy-Pages Job Skipped on PR

**Symptom:** `deploy-pages` job didn't run at all

**Root Cause:** The conditions were too strict and required `main` branch + `push` event:
```yaml
if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

When you run on a PR:
- `github.event_name` = `pull_request` (not `push`)
- `github.ref` = `refs/pull/16/merge` (not `refs/heads/main`)

Both conditions failed, so the job was skipped. **This is by design** - Pages only deploy on main branch pushes to avoid report clutter.

**For PAs, these steps are skipped (expected behavior):**
- Check Playwright report exists
- Upload Pages artifact  
- deploy-pages job

**What DOES run on PRs:**
- Job summary ✅
- Unit test publishing ✅
- PR comment ✅

---

### 3. ❌ GitHub Pages Links Don't Work (Yet)

**Symptom:** The link `https://{owner}.github.io/{repo}/report-{run_id}/` returns 404

**Root Cause:** 
1. Pages deployment only runs on `main` branch pushes (not PRs)
2. GitHub Pages was not configured in repository settings

**Solution:** The workflow will work correctly once:
1. You enable GitHub Pages in repository settings
2. You push to main branch (not a PR)

Then the HTML report will be accessible at:
```
https://{owner}.github.io/{repo}/
```

---

## What Was Fixed

### File: `scripts/parse-test-results.js`

**Before:** Only parsed top-level tests, missed nested suites
**After:** Recursively processes all nested suites to find all tests

### File: `.github/workflows/playwright.yml`

**Minor improvements:**
- Cleaner condition logic on Pages deployment steps
- Better debug output in "Check Playwright report exists" step
- Conditions now clearly show this only runs on main branch pushes

---

## How to Test

### ✅ Test on PR (Should Work)

1. Create a PR to main
2. Workflow runs with tests
3. **Check:**
   - ✅ Job summary appears (top of workflow)
   - ✅ PR comment appears (in conversation tab)
   - ✅ Test results in Checks tab

**Expected:** Parser shows correct numbers (e.g., "Passed: 103")

### ✅ Test on Main Branch (Should Deploy)

1. Merge/push to main branch
2. Workflow runs with tests
3. **Check:**
   - ✅ All PR features above
   - ✅ "Check Playwright report exists" step runs
   - ✅ "Upload Pages artifact" step runs
   - ✅ "deploy-pages" job runs and completes
   - ✅ Settings → Pages shows successful deployment
   - ✅ GitHub Pages URL works: `https://{username}.github.io/{repo}/`

---

## Repository Settings Required

### ✅ GitHub Pages Must Be Enabled

If not already done:

1. Go to **Settings → Pages**
2. Under "Build and deployment":
   - **Source:** Select "Deploy from a branch"
   - **Branch:** Select `gh-pages` / `root`
3. Click **Save**
4. Wait 1-2 minutes

**Result:** Workflow will automatically create and manage the `gh-pages` branch

---

## Why "Two Test Results" Bug?

You mentioned seeing "two playwright results" - this is likely because:

1. **First result:** On your PR - parser was showing zeros (bug we fixed)
2. **Second result:** Maybe from an earlier run, or from the Unit Test Publisher (which shows separate results)

With the parser fix, both should now show the correct numbers.

---

## Testing the Parser Fix

You can test locally:

```bash
# Run tests
npm run test:e2e

# Parse results
node scripts/parse-test-results.js
```

Expected output:
```json
{
  "passed": 103,
  "failed": 0,
  "skipped": 0,
  "total": 103,
  "duration": 130,
  "status": "passed"
}
```

---

## Deployment Flow (Main Branch Only)

When you push to main:

```
Test job runs
    ↓
Tests pass (e.g., 103 passed)
    ↓
Parser extracts results
    ↓
Job summary created (shows correct numbers)
    ↓
Unit tests published (to Checks)
    ↓
Check if report exists (main branch only)
    ↓
Upload Pages artifact (main branch only)
    ↓
deploy-pages job runs (main branch only)
    ↓
GitHub Pages updates
    ↓
Report accessible at: https://{owner}.github.io/{repo}/
```

---

## Pull Request Flow (Different)

When you create a PR:

```
Test job runs
    ↓
Tests pass (e.g., 103 passed)
    ↓
Parser extracts results (FIXED - now shows correct numbers)
    ↓
Job summary created (shows in workflow summary)
    ↓
Unit tests published (to Checks tab)
    ↓
PR comment created (sticky, with correct numbers)
    ↓
Check if report exists (SKIPPED - PR only)
    ↓
Upload Pages artifact (SKIPPED - PR only)
    ↓
deploy-pages job (SKIPPED - PR only)
```

---

## Next Steps

1. **Commit changes:**
   ```bash
   git add -A
   git commit -m "fix: correct Playwright test result parsing and improve Pages deployment

   - Fix parser to recursively process nested Playwright test suites
   - Results now show correct passed/failed/skipped counts
   - Pages deployment properly limited to main branch pushes
   - Add better debug output for Pages deployment troubleshooting"
   
   git push
   ```

2. **Test on PR first:**
   - Create a test PR
   - Check that parser shows correct numbers

3. **Test on Main:**
   - Merge PR to main
   - Verify GitHub Pages deployment completes
   - Check that Pages URL works

4. **Verify GitHub Pages:**
   - Settings → Pages should show successful deployment
   - URL should be active and accessible

---

## Summary of Changes

| File | Change | Reason |
|------|--------|--------|
| `scripts/parse-test-results.js` | Add recursive suite processing | Fix parser returning zeros |
| `.github/workflows/playwright.yml` | Improve Pages deployment conditions | Clarify when deployment runs |

---

## Questions Answered

**Q: Why was deploy-pages skipped?**  
A: You ran on a PR. Deploy-pages only runs on `main` branch pushes.

**Q: Why did the parser show zeros?**  
A: The Playwright JSON has nested suites that weren't being processed. Fixed now.

**Q: Why didn't the link work?**  
A: Pages wasn't deployed (because PR), and GitHub Pages needs to be enabled in settings.

**Q: Will this work correctly now?**  
A: Yes! Test on PR (to verify parser), then push to main (to verify Pages deployment).

---

**Ready to test:** Push these changes and follow the testing steps above.
