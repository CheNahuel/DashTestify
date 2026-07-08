#!/usr/bin/env node

/**
 * Parse Playwright test results and output structured data
 * Used for GitHub Actions job summary and PR comments
 *
 * Handles Playwright JSON reporter output format
 */

const fs = require('fs');
const path = require('path');

const resultsFile = path.join(__dirname, '../test-results/results.json');

if (!fs.existsSync(resultsFile)) {
  const output = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    timestamp: new Date().toISOString(),
    status: 'no_results'
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

try {
  const fileContent = fs.readFileSync(resultsFile, 'utf-8');
  const results = JSON.parse(fileContent);

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let totalDuration = 0;

  // Playwright JSON reporter format: { "suites": [ { "tests": [...] } ] }
  if (results.suites && Array.isArray(results.suites)) {
    results.suites.forEach(suite => {
      // Recursively process suite and nested suites
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
      processSuite(suite);
    });
  }

  const output = {
    passed,
    failed,
    skipped,
    total: passed + failed + skipped,
    duration: Math.round(totalDuration / 1000), // Convert to seconds
    timestamp: new Date().toISOString(),
    status: failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'no_tests'
  };

  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error('Error parsing test results:', error.message);
  const output = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    timestamp: new Date().toISOString(),
    status: 'parse_error'
  };
  console.log(JSON.stringify(output, null, 2));
}
