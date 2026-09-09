import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json')));
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${manifest.version}`) {
  throw new Error(`Tag must match package version: v${manifest.version}`);
}
mkdirSync(output, { recursive: true });
const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', output], {
  cwd: root, encoding: 'utf8',
}));
const sha256 = createHash('sha256').update(readFileSync(resolve(output, packed.filename))).digest('hex');
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
catch { /* A downloaded source tree may not have git metadata. */ }
const metadata = {
  name: manifest.name,
  version: manifest.version,
  filename: packed.filename,
  sha256,
  commit,
  node: process.version,
  runUrl: process.env.GITHUB_ACTIONS === 'true'
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  limitation: 'Build metadata only; this is not architecture assurance evidence.',
};
writeFileSync(resolve(output, 'SHA256SUMS'), `${sha256}  ${packed.filename}\n`);
writeFileSync(resolve(output, 'package-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
