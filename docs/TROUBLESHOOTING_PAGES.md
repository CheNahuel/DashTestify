# GitHub Pages Deployment Troubleshooting

## Issue: Deploy-pages Job Skipped

### Root Causes

1. **`always()` removed the job** — if tests failed, the job condition wasn't met
2. **GitHub Pages not properly configured** — missing settings or permissions
3. **`playwright-report/` directory doesn't exist** — HTML report not generated
4. **Branch protection rules** — preventing `gh-pages` branch deployment

### Diagnostics

#### Step 1: Check GitHub Actions Workflow Run

1. Go to **Actions** tab
2. Click on latest run
3. Look for `deploy-pages` job

**Expected:** Job should appear in the workflow
**Problem:** Job doesn't appear or is grayed out (skipped)

#### Step 2: Check Workflow Logs

Look for these steps in order:

```
✅ Run Playwright tests
  ↓
✅ Debug test results (should list test-results/)
  ↓
✅ Check Playwright report exists (NEW DEBUG STEP)
  ├─ Should show: "✅ playwright-report directory exists"
  └─ Problem: "❌ playwright-report directory NOT FOUND"
  ↓
✅ Upload Pages artifact
  └─ Problem: "Skipped" means hashFiles() returned empty
  ↓
deploy-pages job (should run here)
```

#### Step 3: Enable GitHub Pages

**CRITICAL:** GitHub Pages must be properly configured.

Go to: **Settings → Pages**

Check:
- [ ] "Source" is set to **"Deploy from a branch"**
- [ ] Branch is set to **"gh-pages"**
- [ ] Click "Save" (if you made changes)

**What this does:**
- Tells GitHub to serve content from the `gh-pages` branch
- Workflow automatically creates this branch
- Without this setting, deployment won't work

#### Step 4: Verify Permissions

Check: **Settings → Actions → General**

Verify:
- [ ] Workflow permissions: **"Read and write permissions"**
- [ ] "Allow GitHub Actions to create and approve pull requests" is checked

If not, update and re-run the workflow.

#### Step 5: Check for Branch Protection

Go to: **Settings → Branches**

Look for branch protection rules on `gh-pages`:
- [ ] If exists: Delete or allow GitHub Actions
- [ ] If doesn't exist: This is normal, GitHub will create it

### Common Error Messages

#### Error: "No GitHub Pages configuration found"

**Cause:** GitHub Pages not enabled in settings

**Fix:**
```
Settings → Pages
  → Source: "Deploy from a branch"
  → Branch: "gh-pages"
  → Save
```

#### Error: "The deploy key is invalid"

**Cause:** OIDC token issue (rare)

**Fix:**
1. Go to Settings → Environments → github-pages
2. Review deployment branches
3. Try re-running the workflow

#### Error: "Permission denied" on gh-pages

**Cause:** Branch protection rule blocking the push

**Fix:**
1. Settings → Branches
2. Find `gh-pages` rule
3. Remove or allow GitHub Actions

#### Workflow shows "playwright-report directory NOT FOUND"

**Cause:** HTML reporter not generating report

**Fix:**
1. Check Playwright tests actually ran
2. Verify `playwright.config.ts` has HTML reporter:
   ```typescript
   reporter: [
     ['html', { open: 'never' }],
     ['json', { outputFile: 'test-results/results.json' }],
     ['junit', { outputFile: 'test-results/junit.xml' }]
   ],
   ```
3. Run locally: `npm run test:e2e`
4. Verify `playwright-report/` directory created locally

---

## Issue: Two Test Results, Second Shows 0

### Root Causes

1. **Results file parsed twice** — Parser runs on old/empty data
2. **Two workflows running** — Multiple test results being published
3. **Stale artifacts** — Old results not cleared

### Diagnostics

#### Check Workflow Runs

Go to **Actions** tab:

```
Run 1: ✅ Passed: 42, Failed: 0
Run 2: ❌ Passed: 0, Failed: 0  ← Problem
```

**Question:** Are both runs on the same commit?
- If YES: Something created duplicate results
- If NO: This is normal (two separate runs)

#### Check Test Results File

In workflow logs, look for:

```
Parse test results step
  → Output: test-summary.json
  → Shows metrics
```

**Expected:** Should see JSON with actual numbers

**Problem:** Should show zeros or error

#### Check if Tests Actually Ran

Look for:

```
Run Playwright tests step
  → Should show test count and results
  → Should NOT be skipped
```

**Problem:** If skipped, tests didn't run (check conditions)

---

## Issue: Report Link Doesn't Work

### Root Causes

1. **Pages deployment failed** — report not actually deployed
2. **Incorrect URL format** — pointing to wrong location
3. **Report not generated** — `playwright-report/` empty

### Diagnostics

#### Step 1: Verify Deployment Completed

Go to **Settings → Pages**:
- Should show: "Your site is live at: https://{owner}.github.io/{repo}/"
- Check the URL is clickable and not showing error

#### Step 2: Check Deployment Log

Go to: **Actions** tab

Look for `deploy-pages` job:
- Should show "Deployment successful"
- Check its logs for errors

#### Step 3: Test the URL

Try accessing:
```
https://{owner}.github.io/{repo}/
```

**Expected results:**
- Page loads
- Shows Playwright report
- Can navigate tests

**If 404:**
- Pages not properly enabled (see "Enable GitHub Pages" above)
- Report not deployed (check deployment logs)
- Report directory is empty (check "Debug test results" step)

#### Step 4: Check Report Contents

In workflow logs, look for:

```
Check Playwright report exists step
  → Should show file count
  → Should show: "Total files: 50+" (approximate)
```

**Problem:** Shows "0 files" = report not generated

---

## Full Fix Checklist

- [ ] **GitHub Pages enabled** (Settings → Pages)
  - Source: "Deploy from a branch"
  - Branch: gh-pages
  - Saved and wait 1-2 minutes
  
- [ ] **Workflow permissions** (Settings → Actions → General)
  - Workflow permissions: "Read and write permissions"
  
- [ ] **No branch protection** on gh-pages
  - Settings → Branches → check for gh-pages rules
  
- [ ] **Push to main branch** (not PR)
  - Workflow only deploys on `push` to main
  
- [ ] **Tests actually run**
  - Check workflow logs for "Run Playwright tests" step
  - Should show test count
  
- [ ] **Report generated**
  - Check "Check Playwright report exists" step
  - Should show file count > 0
  
- [ ] **Wait for deployment**
  - Deployment takes ~10-15 seconds after upload
  - Don't refresh too quickly

---

## Debug Commands (Run Locally)

```bash
# Test Playwright configuration
npm run test:e2e

# Verify report was generated
ls -la playwright-report/
ls playwright-report/index.html

# Check what files exist
find playwright-report -type f | head -20

# Verify JSON reporter works
ls -la test-results/results.json

# Test parser script
node scripts/parse-test-results.js
```

---

## GitHub Pages Status Check

```
✅ Working: Shows Playwright report
❌ 404: Pages not enabled
❌ Blank page: Report not deployed
❌ Old report: Deployment cached
```

---

## Next Steps

1. **Check all items in checklist above**
2. **Push code with new debug steps**
3. **Check "Check Playwright report exists" step output**
4. **Verify GitHub Pages URL works**
5. **If still failing:** Share workflow logs with error details

---

## Example: Successful Deployment Flow

```
✅ Checkout repository
✅ Setup Node
✅ Install dependencies
✅ Run Playwright tests
   → Tests: 42 passed, 0 failed
✅ Parse test results
   → test-summary.json created with metrics
✅ Create GitHub Actions Job Summary
   → Summary displayed at top of run
✅ Upload Playwright report as artifact
   → playwright-report-123456 uploaded
✅ Publish Unit Test Results
   → Results published to GitHub
✅ Comment on Pull Request
   → (skipped - this is push to main)
✅ Check Playwright report exists
   → ✅ playwright-report directory exists
   → Total files: 52
✅ Upload Pages artifact
   → Artifact uploaded for deployment
✅ deploy-pages job
   → ✅ Deployment successful
   → URL: https://{owner}.github.io/{repo}/
```

---

**Need more help?** Share the workflow log output and I can provide more specific guidance.
