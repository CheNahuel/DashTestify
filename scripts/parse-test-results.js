#!/usr/bin/env node

/**
 * Parse Playwright test results and output structured data
 * Used for GitHub Actions job summary and PR comments
 */

const fs = require('fs');
const path = require('path');

const resultsFile = path.join(__dirname, '../test-results/results.json');

if (!fs.existsSync(resultsFile)) {
  console.log('No test results found');
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

let passed = 0;
let failed = 0;
let skipped = 0;
let totalDuration = 0;

if (results.suites && Array.isArray(results.suites)) {
  results.suites.forEach(suite => {
    if (suite.tests) {
      suite.tests.forEach(test => {
        totalDuration += test.duration || 0;
        if (test.status === 'passed') passed++;
        else if (test.status === 'failed') failed++;
        else if (test.status === 'skipped') skipped++;
      });
    }
  });
}

const output = {
  passed,
  failed,
  skipped,
  total: passed + failed + skipped,
  duration: Math.round(totalDuration / 1000), // Convert to seconds
  timestamp: new Date().toISOString(),
  status: failed > 0 ? 'failed' : 'passed'
};

console.log(JSON.stringify(output, null, 2));
