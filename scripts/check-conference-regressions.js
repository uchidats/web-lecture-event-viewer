const path = require('node:path');
const { runChecks } = require('./auto-updater/storage');
const result = runChecks(path.resolve(__dirname, '..'));
for (const test of result.results) {
  console.log(`${test.passed ? 'PASS' : 'FAIL'}: ${test.command}`);
  if (!test.passed) console.error(test.error || test.output);
}
if (!result.passed) process.exitCode = 1;
