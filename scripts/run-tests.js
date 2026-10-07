/* One-shot test runner for the top-level suites.

   Runs every tests/*.test.js through the current Node, then every
   server/test_*.py through the project venv, in deterministic order.
   No shell is involved: file paths are passed to spawnSync directly, so a
   file name with spaces or special characters cannot inject commands.

       node scripts/run-tests.js

   Scope: only the tests/*.test.js glob (non-recursive) plus server/test_*.py.
   Nested probes under tests/audit/** record known defects and stay out of the
   exit code, so they are listed explicitly in the output rather than omitted
   silently. This command is not "every test in the repo".

   All configured tests still run when one fails; the summary and exit code
   cover those. Exit code 0 only when every configured test passed.
*/
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const testsDir = path.join(root, 'tests');
const serverDir = path.join(root, 'server');
const venvPython = path.join(
  serverDir,
  '.venv',
  process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python'
);

const jsTests = fs.readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => ({
    label: `tests/${file}`,
    file: path.join(testsDir, file),
    cwd: root,
    command: process.execPath,
  }));

// Nested probes under tests/audit/** are deliberately outside the exit code: they
// record known defects (see 4c2882f), so gating on them would leave this command
// permanently red. They are listed rather than silently skipped — a "0 failed"
// summary must never imply they were run.
function findNestedTests(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findNestedTests(full);
    return entry.name.endsWith('.test.js') ? [full] : [];
  });
}

const nestedTests = fs.readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => findNestedTests(path.join(testsDir, entry.name)))
  .sort();

const pythonTests = fs.existsSync(venvPython)
  ? fs.readdirSync(serverDir)
      .filter((file) => file.startsWith('test_') && file.endsWith('.py'))
      .sort()
      .map((file) => ({
        label: `server/${file}`,
        file: path.join(serverDir, file),
        cwd: serverDir,
        command: venvPython,
      }))
  : null;

let passed = 0;
let failed = 0;

function runGroup(title, tests) {
  console.log(`\n== ${title} ==`);
  for (const test of tests) {
    const result = spawnSync(test.command, [test.file], {
      cwd: test.cwd,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const ok = !result.error && result.status === 0 && !result.signal;
    if (ok) {
      passed += 1;
      console.log(`PASS ${test.label}`);
      continue;
    }
    failed += 1;
    console.log(`FAIL ${test.label}`);
    if (result.error) console.log(`  ${result.error.message}`);
    if (result.signal) console.log(`  terminated by ${result.signal}`);
    if (result.stdout) console.log(result.stdout.trimEnd());
    if (result.stderr) console.log(result.stderr.trimEnd());
  }
}

runGroup('JS tests', jsTests);

if (pythonTests) {
  runGroup('Python tests', pythonTests);
} else {
  console.log('\n== Python tests ==');
  console.log(`SKIP ${venvPython} not found (create server/.venv and install requirements first)`);
}

function reportNested(tests) {
  console.log('\n== Nested probes (NOT run) ==');
  if (!tests.length) {
    console.log('none');
    return;
  }
  for (const test of tests) console.log(`SKIP ${path.relative(root, test)}`);
  console.log(
    `\n${tests.length} file(s) above sit below tests/ and are outside the tests/*.test.js glob,` +
    '\nso they are absent from the totals below. Run them explicitly with:' +
    "\n  for f in $(find tests -mindepth 2 -name '*.test.js'); do node \"$f\"; done"
  );
}

reportNested(nestedTests);

// The skipped count rides on the totals line too: a consumer that only greps the
// last line must not read this as "everything ran and passed".
const skippedNote = nestedTests.length ? ` (${nestedTests.length} nested probes not run)` : '';
console.log(`\n${passed} passed, ${failed} failed${skippedNote}`);
process.exit(failed > 0 || pythonTests === null ? 1 : 0);
