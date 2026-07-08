#!/usr/bin/env node

/**
 * Parse Playwright test results and output structured data
 * Used for GitHub Actions job summary and PR comments
 *
 * Reads from Playwright JSON reporter: test-results/results.json
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

  // Playwright JSON format has stats at top level
  if (results.stats) {
    const stats = results.stats;
    const passed = stats.expected || 0;
    const failed = stats.unexpected || 0;
    const skipped = stats.skipped || 0;
    const totalDuration = stats.duration || 0;

    const output = {
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      duration: Math.round(totalDuration / 1000), // Convert ms to seconds
      timestamp: new Date().toISOString(),
      status: failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'no_tests'
    };

    console.log(JSON.stringify(output, null, 2));
  } else {
    throw new Error('No stats found in Playwright results.json');
  }
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
