import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ag, repoRoot } from './helpers.js';

test('AG\'s own tripwires pass on this repository: browser-safe core and the package split', () => {
  const result = ag('audit', '--config', join(repoRoot, 'ag.config.json'), '--tripwires', '--json');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.checks.map(c => c.id).sort(), ['check:audit-uses-core-public-api', 'check:core-browser-safe', 'check:core-without-audit']);
  assert.deepEqual(report.findings.map(f => [f.classification, f.key]), [['baselined', 'check:core-without-audit|unresolved|src/cli.ts|pathToFileURL(entry).href']]);
});
