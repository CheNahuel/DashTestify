# Artifact-Based Playwright Reporting

## Simplified Approach ✅

Instead of deploying to GitHub Pages, we now use **GitHub Actions Artifacts** as the single source of truth for Playwright HTML reports.

### Why This Is Better

| Feature | Artifact Approach | GitHub Pages Approach |
|---------|------------------|----------------------|
| **Setup Complexity** | ✅ None - uses built-in artifact storage | ❌ Requires Pages configuration |
| **Always Current** | ✅ Each run has unique artifact with `{run_id}` | ❌ Latest deploy overwrites previous |
| **No Stale Reports** | ✅ Each artifact is independent | ❌ Can show old cached reports |
| **Retention** | ✅ 30 days (configurable) | ❌ Forever (can accumulate) |
| **Permissions** | ✅ Minimal (read, write, checks) | ❌ Extra (pages, id-token) |
| **Maintenance** | ✅ Zero - GitHub manages storage | ❌ Need to manage gh-pages branch |

---

## How It Works

### Report Generation
```
Test Run
  ↓
Playwright generates HTML report in `playwright-report/`
  ↓
`playwright-report/index.html` + assets uploaded as artifact
  ↓
Artifact named: `playwright-report-{run_id}`
  ↓
Each artifact is independent and never changes
```

### Accessing Reports

#### In GitHub Actions Summary
1. Go to **Actions** tab
2. Click the workflow run
3. Scroll to **Summary** section
4. See test metrics in the summary
5. See download instructions for the artifact

#### Download Artifact
1. Go to **Actions** tab → workflow run
2. Scroll down to **Artifacts** section
3. Click **playwright-report-{run_id}** to download ZIP
4. Extract ZIP locally
5. Open `playwright-report/index.html` in browser

---

## What Happens Every Run

### Test Execution
```
✅ Tests run
✅ Playwright generates HTML report
✅ JSON results generated for parsing
✅ JUnit XML generated for test publishing
```

### Reporting
```
✅ Parse test results
✅ Display metrics in job summary
✅ Show artifact download instructions
✅ Upload artifact (unique per run)
✅ Publish unit test results to GitHub
✅ Comment on PR (if PR)
```

### Result
```
📦 Artifact: playwright-report-{run_id}.zip
  └─ playwright-report/
     ├─ index.html ← Open this in browser
     ├─ trace files
     ├─ screenshots
     └─ videos
```

---

## Accessing Old Reports

All artifacts are kept for **30 days** by default.

### View Previous Run Reports
1. Go to **Actions** tab
2. Scroll through workflow runs
3. Find the run you want
4. Click it to see its artifacts
5. Download that run's artifact

This way you can always compare results across multiple runs.

---

## Permissions Required

```yaml
permissions:
  contents: read       # Read repository
  checks: write       # Publish unit test results
  pull-requests: write # Comment on PRs
```

**That's it!** No Pages configuration needed.

---

## Configuration

### Change Artifact Retention (Optional)

In `.github/workflows/playwright.yml`:

```yaml
- name: Upload Playwright report as artifact
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report-${{ github.run_id }}
    path: playwright-report/
    retention-days: 30  # ← Change this number
    if-no-files-found: warn
```

**Default:** 30 days  
**Min:** 1 day  
**Max:** 90 days (GitHub Free) or unlimited (GitHub Pro)

---

## What's NOT Needed

❌ GitHub Pages configuration  
❌ `gh-pages` branch management  
❌ Deploy jobs  
❌ Pages permissions  
❌ Domain setup  
❌ Cache busting  

---

## Viewing Reports

### From GitHub UI
1. Actions → Run → Artifacts → Download ZIP
2. Extract → Open `playwright-report/index.html`
3. View interactive report in browser

### Direct Command (If Workflow Is Local)
```bash
# After running tests locally
npm run test:e2e
npx playwright show-report
```

---

## Job Summary Example

```
## ✅ Playwright Test Results

| Metric | Value |
|--------|-------|
| Passed | 103 |
| Failed | 0 |
| Skipped | 0 |
| Duration | 130s |

### 📦 HTML Report
Download the artifact `playwright-report-28963358212` from the Artifacts section below to view the interactive HTML report.

Steps to view:
1. Click Artifacts section (bottom of workflow summary)
2. Download `playwright-report-28963358212.zip`
3. Extract the ZIP file
4. Open `playwright-report/index.html` in your browser

Retention: 30 days
```

---

## PR Comments

On pull requests, you'll see:

```
## ✅ Playwright Test Report

**Test Summary:**
- ✅ Passed: 103
- ❌ Failed: 0
- ⏭️ Skipped: 0
- ⏱️ Duration: 130s

**📋 Links:**
- [HTML Report](https://github.com/CheNahuel/DashTestify/actions/runs/123456)
- [GitHub Actions Run](https://github.com/CheNahuel/DashTestify/actions/runs/123456)
```

Click the link to go to the Actions run where you can download the artifact.

---

## Storage Limits

### GitHub Free
- 500 MB total artifact storage
- 30-day retention max
- Typical Playwright report: 1-5 MB

### GitHub Pro/Enterprise
- Much higher limits
- 90-day retention
- Rarely an issue

---

## Troubleshooting

### Artifact Missing
**Check:**
1. Did tests actually run?
2. Is `playwright-report/` directory created?
3. Check workflow logs for upload step

**Debug:**
```bash
# Run locally
npm run test:e2e

# Check if report was generated
ls -la playwright-report/index.html
```

### Wrong Report Showing
**Cause:** Downloaded old artifact

**Fix:**
1. Verify you're on the correct workflow run
2. Download the latest artifact (top of Artifacts list)
3. Check artifact name includes latest `run_id`

### Artifact Too Large
**If storage is getting full:**
1. Reduce retention: set `retention-days: 7` or `14`
2. Archive old runs manually
3. Upgrade to GitHub Pro

---

## Workflow Diagram

```
Trigger
  ↓
Test Job
  ├─ Run tests
  ├─ Generate playwright-report/
  ├─ Generate test-results/ (JSON, JUnit)
  ├─ Parse results
  ├─ Create job summary
  ├─ Upload artifact (unique per run)
  ├─ Publish unit tests
  ├─ Comment on PR (if PR)
  └─ Upload to Supabase
    ↓
Complete
  ↓
Artifact Available
  └─ Download anytime in next 30 days
```

---

## Summary

- ✅ **Simple:** No Pages setup needed
- ✅ **Fresh:** Each run has unique report
- ✅ **Reliable:** Built-in GitHub storage
- ✅ **Complete:** All reporting features included
- ✅ **Flexible:** Keep reports as long as needed (up to 90 days)

---

**Next Steps:** Commit changes and test the workflow. Each run will have its own independent artifact with a fresh report.
