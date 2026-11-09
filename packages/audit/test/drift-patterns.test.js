import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ReportSchema } from '../lib/index.js';
import { ag } from './helpers.js';

// One committed fixture per drift pattern with a version 1 response (docs/specs/architecture-audit.md,
// "How the drift patterns map"). Each passes core validation and fails the audit for the stated reason,
// through the real `ag audit` hand-off resolving this workspace's audit package.
const fixture = name => join(import.meta.dirname, 'fixtures', name, 'ag.config.json');
const patterns = [
  ['specifics-in-the-platform', 'check:platform-independent-of-features|dep|src/platform/assemble-report.ts->src/features/fine-grained/compile.ts'],
];

for (const [name, key] of patterns) {
  test(`drift pattern ${name}: ag validate passes, ag audit fails with ${key.split('|')[1]}`, () => {
    const validated = ag('validate', '--config', fixture(name));
    assert.equal(validated.status, 0, validated.stderr);
    const audited = ag('audit', '--config', fixture(name), '--json');
    assert.equal(audited.status, 3, audited.stderr);
    const report = JSON.parse(audited.stdout);
    assert(ReportSchema.safeParse(report).success);
    assert.deepEqual(report.findings.map(f => [f.classification, f.key]), [['new', key]]);
    assert.equal(report.coverage.unresolvedImports, 0);
  });
}
