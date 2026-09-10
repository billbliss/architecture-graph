import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function releaseArtifact(root, env = process.env) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json')));
  const metadata = JSON.parse(readFileSync(resolve(root, 'dist/package-metadata.json')));
  assert.equal(metadata.name, '@billbliss/architecture-graph');
  assert.equal(metadata.name, manifest.name);
  assert.equal(metadata.version, manifest.version);
  assert.match(metadata.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Only stable versions are published to latest');
  assert.equal(metadata.filename, `billbliss-architecture-graph-${metadata.version}.tgz`);
  if (env.GITHUB_ACTIONS === 'true') {
    assert.equal(env.GITHUB_EVENT_NAME, 'push', 'Only a tag push can release');
    assert.equal(env.GITHUB_REF, `refs/tags/v${metadata.version}`, 'Tag must match package version');
    assert.equal(env.GITHUB_REPOSITORY, 'billbliss/architecture-graph');
    assert.equal(metadata.commit, env.GITHUB_SHA, 'Artifact must come from this commit');
  }
  const path = resolve(root, 'dist', metadata.filename);
  const bytes = readFileSync(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256, 'Tarball checksum mismatch');
  return { ...metadata, path, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
}

export async function publishedVersion(artifact, request = fetch) {
  const response = await request(`https://registry.npmjs.org/${encodeURIComponent(artifact.name)}/${artifact.version}`, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry lookup failed: HTTP ${response.status}`);
  const published = await response.json();
  assert.equal(published.name, artifact.name);
  assert.equal(published.version, artifact.version);
  assert.equal(published.dist?.integrity, artifact.integrity, 'Published version differs from tested archive; do not overwrite or reuse the version');
  return published;
}
