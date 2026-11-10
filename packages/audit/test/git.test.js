import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project, platformCheck, keys } from './helpers.js';

const C = 'check:platform-independent-of-features';
const feature = { 'src/features/compile.ts': 'export const compile = 1;\n' };
const scratch = "import '../features/compile.js';\n";
const dep = from => `new ${C}|dep|${from}->src/features/compile.ts`;
const git = (root, ...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};
/** A temporary project made into a git work tree, with everything but `untracked` committed. */
function repository(t, files, untracked = {}) {
  const p = project(t, { checks: platformCheck(), files });
  git(p.root, 'init', '-q');
  git(p.root, 'add', '-A');
  git(p.root, '-c', 'user.name=Audit Test', '-c', 'user.email=audit@example.invalid', 'commit', '-q', '-m', 'fixture');
  for (const [path, text] of Object.entries(untracked)) { mkdirSync(join(p.root, path, '..'), { recursive: true }); writeFileSync(join(p.root, path), text); }
  return p;
}

test('inside a git work tree, an ignored file is not seen; the same file un-ignored is', t => {
  const p = repository(t, { ...feature, '.gitignore': 'src/platform/scratch.ts\n' }, { 'src/platform/scratch.ts': scratch });
  assert.deepEqual(keys(p.report()), [], 'an ignored file matching a from glob produces no finding');
  writeFileSync(join(p.root, '.gitignore'), '');
  assert.deepEqual(keys(p.report()), [dep('src/platform/scratch.ts')]);
});

test('inside a git work tree, tracked and untracked-not-ignored files are seen; deleted, nested and linked files are not', t => {
  const p = repository(t, { ...feature, 'src/platform/tracked.ts': scratch, 'src/platform/deleted.ts': scratch }, { 'src/platform/new.ts': scratch });
  rmSync(join(p.root, 'src/platform/deleted.ts'));
  mkdirSync(join(p.root, 'src/platform/nested'));
  git(join(p.root, 'src/platform/nested'), 'init', '-q');
  writeFileSync(join(p.root, 'src/platform/nested/inner.ts'), scratch);
  symlinkSync(join(p.root, 'src/platform/tracked.ts'), join(p.root, 'src/platform/link.ts'));
  assert.deepEqual(keys(p.report()), [dep('src/platform/new.ts'), dep('src/platform/tracked.ts')]);
});

test('outside a git work tree, the audit reads every regular file', t => {
  const p = project(t, { checks: platformCheck(), files: { ...feature, '.gitignore': 'src/platform/scratch.ts\n', 'src/platform/scratch.ts': scratch } });
  assert.deepEqual(keys(p.report()), [dep('src/platform/scratch.ts')], '.gitignore has no effect without git');
});

test('a work tree git cannot list is an audit configuration error, never a silent walk', async t => {
  const broken = project(t, { checks: platformCheck(), files: { ...feature, '.git': 'gitdir: /nonexistent/repository\n', 'src/platform/a.ts': scratch } });
  const result = await broken.run(t, ['--json']);
  assert.equal(result.code, 1);
  const [error] = JSON.parse(result.stderr).errors;
  assert.equal(error.code, 'audit-config');
  assert.match(error.message, /git ls-files failed.*does not fall back/);

  const noGit = repository(t, feature);
  const path = process.env.PATH;
  process.env.PATH = join(noGit.root, 'no-such-bin');
  t.after(() => { process.env.PATH = path; });
  const missing = await noGit.run(t);
  process.env.PATH = path;
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /git is not installed or not on PATH/);
});
