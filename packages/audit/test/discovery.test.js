import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, platformCheck, keys } from './helpers.js';

const C = 'check:platform-independent-of-features';
const feature = { 'src/features/compile.ts': 'export const compile = 1;\n', 'src/features/types.ts': 'export interface Shape { a: number }\n' };
const dep = (from, to = 'src/features/compile.ts') => `new ${C}|dep|${from}->${to}`;

test('type-only imports and exports are not runtime edges', t => {
  const p = project(t, { checks: platformCheck(), files: { ...feature,
    'src/platform/a.ts': [
      "import type { Shape } from '../features/types.js';",
      "import { type Shape as S2, type Shape as S3 } from '../features/types.js';",
      "export type { Shape } from '../features/types.js';",
      "export { type Shape as S4 } from '../features/types.js';",
      "import type T = require('../features/compile.js');",
      "let x: typeof import('../features/compile.js');",
    ].join('\n') } });
  const report = p.report();
  assert.deepEqual(keys(report), []);
  assert.equal(report.coverage.filesParsed, 1);
});

test('every runtime import form is an edge', t => {
  const forms = {
    'side-effect.ts': "import '../features/compile.js';",
    'named.ts': "import { compile } from '../features/compile.js';",
    'mixed-type.ts': "import { type Shape, compile } from '../features/compile.js';",
    'export-star.ts': "export * from '../features/compile.js';",
    'export-named.ts': "export { compile } from '../features/compile.js';",
    'import-equals.ts': "import c = require('../features/compile.js');",
    'require.cjs': "const c = require('../features/compile.js');",
    'dynamic.ts': 'const c = await import(`../features/compile.js`);',
    'jsx.tsx': "import { compile } from '../features/compile.js';\nexport const view = <div>{compile}</div>;",
  };
  const p = project(t, { checks: platformCheck(), files: { ...feature, ...Object.fromEntries(Object.entries(forms).map(([name, text]) => [`src/platform/${name}`, text + '\n'])) } });
  assert.deepEqual(keys(p.report()), Object.keys(forms).map(name => dep(`src/platform/${name}`)).sort());
});

test('relative specifiers: exact file, emitted-extension counterpart, then directory index; ambiguity is a finding', t => {
  const p = project(t, { checks: platformCheck(), files: {
    'src/features/compile.ts': '', 'src/features/legacy.js': '', 'src/features/widget/index.tsx': '',
    'src/features/both.ts': '', 'src/features/both.tsx': '',
    'src/platform/a.ts': [
      "import './../features/compile.js';", "import '../features/legacy.js';", "import '../features/widget';",
      "import '../features/compile';", "import '../features/both.js';",
    ].join('\n'),
  } });
  assert.deepEqual(keys(p.report()), [
    dep('src/platform/a.ts'), dep('src/platform/a.ts', 'src/features/legacy.js'), dep('src/platform/a.ts', 'src/features/widget/index.tsx'),
    `new ${C}|unresolved|src/platform/a.ts|../features/both.js`,
  ].sort());
  assert.match(p.report().findings.find(f => f.kind === 'unresolved_import').evidence.reason, /ambiguous: src\/features\/both\.ts, src\/features\/both\.tsx/);
});

test('aliases come from the configured tsconfig; unmatched bare specifiers are external terminals', t => {
  const p = project(t, {
    checks: platformCheck(),
    tsconfig: { compilerOptions: { module: 'nodenext', paths: { '@features/*': ['./src/features/*'], '@outside/*': ['../elsewhere/*'], '@gone/*': ['./src/gone/*'] } } },
    files: { ...feature, 'src/platform/a.ts': [
      "import { compile } from '@features/compile.js';",
      "import '@outside/x';", "import '@gone/x';",
      "import { readFileSync } from 'fs';", "import 'node:path';", "import ts from 'typescript/lib/typescript.js';", "import '@scope/pkg/deep';",
    ].join('\n') },
  });
  const report = p.report();
  assert.deepEqual(keys(report), [dep('src/platform/a.ts'), `new ${C}|unresolved|src/platform/a.ts|@gone/x`, `new ${C}|unresolved|src/platform/a.ts|@outside/x`].sort());
  assert.deepEqual(report.coverage.externalTerminals, ['@scope/pkg', 'node:fs', 'node:path', 'typescript']);
  assert.equal(report.coverage.unresolvedImports, 2);
});

test('baseUrl resolves bare specifiers inside the repository before treating them as packages', t => {
  const p = project(t, { checks: platformCheck(), tsconfig: { compilerOptions: { baseUrl: './src' } },
    files: { ...feature, 'src/platform/a.ts': "import 'features/compile';\nimport 'lodash';\n" } });
  const report = p.report();
  assert.deepEqual(keys(report), [dep('src/platform/a.ts')]);
  assert.deepEqual(report.coverage.externalTerminals, ['lodash']);
});

test('dynamic, escaping and missing imports are unresolved findings, never silent passes', t => {
  const p = project(t, { checks: platformCheck(), files: { ...feature, 'src/platform/a.ts': [
    'const name = "x";', 'await import(name);', 'require(`../features/${name}`);', "import '../../../outside.js';", "import './missing.js';",
  ].join('\n') } });
  const report = p.report();
  assert.deepEqual(keys(report), [
    `new ${C}|unresolved|src/platform/a.ts|../../../outside.js`, `new ${C}|unresolved|src/platform/a.ts|./missing.js`,
    `new ${C}|unresolved|src/platform/a.ts|\`../features/\${name}\``, `new ${C}|unresolved|src/platform/a.ts|name`,
  ].sort());
  const reasons = Object.fromEntries(report.findings.map(f => [f.evidence.specifier, f.evidence.reason]));
  assert.match(reasons['../../../outside.js'], /outside the repository/);
  assert.match(reasons['name'], /not a string literal/);
  assert.equal(report.findings.find(f => f.evidence.specifier === 'name').evidence.line, 2);
});

test('unsupported syntax in a checked file is a finding; elsewhere it is never parsed', t => {
  const p = project(t, { checks: platformCheck(), files: { ...feature,
    'src/platform/broken.ts': 'export const = ;\n', 'src/unrelated/broken.ts': 'export const = ;\n', 'src/platform/fine.ts': 'export const ok = 1;\n' } });
  const report = p.report();
  assert.deepEqual(keys(report), [`new ${C}|unresolved|src/platform/broken.ts|<syntax>`]);
  assert.equal(report.coverage.filesParsed, 2);
});

test('negative space: a new violating file is found without naming it anywhere', t => {
  const p = project(t, { checks: platformCheck(), files: { ...feature, 'src/platform/clean.ts': "import './other.js';\n", 'src/platform/other.ts': '' } });
  assert.deepEqual(keys(p.report()), []);
  const q = project(t, { checks: platformCheck(), files: { ...feature, 'src/platform/clean.ts': '', 'src/platform/deep/new.ts': "import '../../features/compile.js';\n" } });
  assert.deepEqual(keys(q.report()), [dep('src/platform/deep/new.ts')]);
});

test('globs work as selectors without modules, and non-source files in scope are not parsed', t => {
  const p = project(t, { modules: [], audit: { modules: {} }, checks: platformCheck({ from: ['src/platform/**'], to: ['src/features/*.ts'] }),
    files: { ...feature, 'src/platform/README.md': 'import "../features/compile.js"', 'src/platform/a.mts': "import '../features/compile.js';\n" } });
  assert.deepEqual(keys(p.report()), [dep('src/platform/a.mts')]);
});
