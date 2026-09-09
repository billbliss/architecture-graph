import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(readFileSync(resolve(root, 'dist/package-metadata.json')));
const tarball = resolve(root, 'dist', metadata.filename);
const sha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
if (sha256 !== metadata.sha256) throw new Error('Tarball does not match package metadata');
const result = spawnSync(process.execPath, ['test/consumer.mjs'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, AG_TARBALL: tarball },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
