import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, keys } from './helpers.js';

const R = 'check:entry-avoids-features';
const reach = (extra = {}) => [{
  id: R, kind: 'forbidden_reachability', mode: 'tripwire', description: 'The entry must not reach feature code.',
  entries: ['src/platform/entry.ts'], forbidden: ['module:features'], ...extra,
}];

test('reachability reports each forbidden file once per entry, with a shortest import path as evidence', t => {
  const p = project(t, { checks: reach(), files: {
    'src/platform/entry.ts': "import './long.js';\nimport './short.js';\n",
    'src/platform/long.ts': "import './middle.js';\n",
    'src/platform/middle.ts': "import '../features/compile.js';\n",
    'src/platform/short.ts': "import '../features/compile.js';\nimport './entry.js';\n",
    'src/features/compile.ts': "import './helper.js';\n",
    'src/features/helper.ts': '',
  } });
  const report = p.report();
  assert.deepEqual(keys(report), [
    `new ${R}|reach|src/platform/entry.ts->src/features/compile.ts`,
    `new ${R}|reach|src/platform/entry.ts->src/features/helper.ts`,
  ]);
  const compile = report.findings[0];
  assert.deepEqual(compile.evidence.path, ['src/platform/entry.ts', 'src/platform/short.ts', 'src/features/compile.ts']);
  assert.deepEqual([compile.evidence.file, compile.evidence.line], ['src/platform/short.ts', 1]);
  assert.match(compile.message, /src\/platform\/entry\.ts -> src\/platform\/short\.ts -> src\/features\/compile\.ts/);
  assert.equal(report.coverage.filesParsed, 6, 'the cycle back to the entry is followed once');
});

test('the key omits the intermediate path, so refactoring the modules in between keeps the finding identity', t => {
  const files = path => ({ 'src/platform/entry.ts': `import './${path}.js';\n`, [`src/platform/${path}.ts`]: "import '../features/compile.js';\n", 'src/features/compile.ts': '' });
  assert.deepEqual(keys(project(t, { checks: reach(), files: files('a') }).report()), keys(project(t, { checks: reach(), files: files('b') }).report()));
});

test('only files reached from the entries are parsed: unreachable unsupported syntax is ignored', t => {
  const p = project(t, { checks: reach(), files: {
    'src/platform/entry.ts': "import './fine.js';\n", 'src/platform/fine.ts': '',
    'src/platform/broken.ts': 'export const = ;\n', 'src/features/compile.ts': 'export const = ;\n',
  } });
  const report = p.report();
  assert.deepEqual(keys(report), []);
  assert.equal(report.coverage.filesParsed, 2);
  const reached = project(t, { checks: reach(), files: { 'src/platform/entry.ts': "import './broken.js';\n", 'src/platform/broken.ts': 'export const = ;\n' } });
  assert.deepEqual(keys(reached.report()), [`new ${R}|unresolved|src/platform/broken.ts|<syntax>`]);
});

test('forbiddenPackages match external terminals, with Node built-ins normalized to node:', t => {
  const p = project(t, { checks: reach({ forbidden: [], forbiddenPackages: ['node:*', 'typescript', '@scope/*'] }), files: {
    'src/platform/entry.ts': "import './io.js';\nimport 'yaml';\n",
    'src/platform/io.ts': "import { readFileSync } from 'fs';\nimport 'node:path';\nimport ts from 'typescript/lib/typescript.js';\nimport '@scope/pkg/deep';\nimport '@other/pkg';\n",
  } });
  const report = p.report();
  assert.deepEqual(keys(report), ['@scope/pkg', 'node:fs', 'node:path', 'typescript'].map(name => `new ${R}|reach|src/platform/entry.ts->${name}`));
  assert.deepEqual(report.findings.find(f => f.key.endsWith('->node:fs')).evidence.path, ['src/platform/entry.ts', 'src/platform/io.ts', 'node:fs']);
  assert.deepEqual(report.coverage.externalTerminals, ['@other/pkg', '@scope/pkg', 'node:fs', 'node:path', 'typescript', 'yaml']);
});

test('type-only imports do not make code reachable; unresolved imports in reached files are findings', t => {
  const p = project(t, { checks: reach(), files: {
    'src/platform/entry.ts': "import type { Shape } from '../features/types.js';\nconst name = 'x';\nawait import(name);\n",
    'src/features/types.ts': 'export interface Shape { a: number }\n',
  } });
  assert.deepEqual(keys(p.report()), [`new ${R}|unresolved|src/platform/entry.ts|name`]);
});

test('every entry is searched separately and keyed by entry', t => {
  const p = project(t, { checks: reach({ entries: ['src/platform/entry.ts', 'src/platform/other.ts'] }), files: {
    'src/platform/entry.ts': "import './shared.js';\n", 'src/platform/other.ts': "import './shared.js';\n",
    'src/platform/shared.ts': "import '../features/compile.js';\n", 'src/features/compile.ts': '',
  } });
  assert.deepEqual(keys(p.report()), ['entry', 'other'].map(name => `new ${R}|reach|src/platform/${name}.ts->src/features/compile.ts`));
});

test('an entry must be an existing source file', t => {
  const p = project(t, { checks: reach({ entries: ['src/platform/notes.md'] }), files: { 'src/platform/notes.md': '' } });
  assert.throws(() => p.load(), error => error.diagnostics.some(d => d.code === 'entry' && /not a TypeScript or JavaScript source file/.test(d.message)));
});
