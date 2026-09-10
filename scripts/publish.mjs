import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { releaseArtifact, publishedVersion } from './release-artifact.mjs';
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Automated publishing runs only in GitHub Actions');
assert.equal(process.env.NPM_PUBLISH_ENABLED, 'true');
const artifact = releaseArtifact(process.cwd());
if (await publishedVersion(artifact)) {
  console.log('This exact archive is already published; continuing with installation verification.');
} else {
  // Publish once. A failed/uncertain publish is inspected on a workflow rerun, not blindly retried.
  execFileSync('npm', ['publish', artifact.path, '--access', 'public', '--tag', 'latest', '--registry=https://registry.npmjs.org', '--ignore-scripts'], { stdio: 'inherit' });
}
