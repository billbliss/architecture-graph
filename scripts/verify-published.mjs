import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { releaseArtifact, publishedVersion } from './release-artifact.mjs';
const artifact = releaseArtifact(process.cwd());
// Fresh npm packages can have version metadata before the package-name index catches up.
const deadline = Date.now() + 10 * 60 * 1000;
let root;
try {
  while (true) {
    root = mkdtempSync(join(tmpdir(), 'ag-published-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'ag-release-check', version: '1.0.0', private: true }));
    try {
      assert(await publishedVersion(artifact), 'Version metadata not yet available');
      execFileSync('npm', ['install', '--save-dev', `${artifact.name}@${artifact.version}`, '--registry=https://registry.npmjs.org', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, stdio: 'pipe', timeout: 90000, env: { ...process.env, npm_config_cache: join(root, 'npm-cache') } });
      break;
    } catch (error) {
      rmSync(root, { recursive: true, force: true }); root = undefined;
      if (error.message.includes('differs from tested archive') || Date.now() >= deadline) throw error;
      console.log('Registry installation not ready; retrying in 30 seconds. Publication is not retried.');
      await setTimeout(30000);
    }
  }
  const ag = join(root, 'node_modules/.bin/ag');
  const run = args => execFileSync(ag, args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(run(['--version']), artifact.version);
  run(['skill', 'install', '--agent', 'codex,claude']);
  for (const agent of ['.agents', '.claude']) assert(existsSync(join(root, agent, 'skills/architecture-graph/references/modeling.md')));
  run(['init', '--id', 'graph:release-check', '--title', 'Release check']);
  run(['validate']); run(['generate']);
  assert.deepEqual(JSON.parse(run(['check'])).drift, []);
  console.log(`Verified ${artifact.name}@${artifact.version}: registry integrity, clean installation, CLI, both skills and graph lifecycle.`);
} finally { if (root) rmSync(root, { recursive: true, force: true }); }
