import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export async function checkReleaseEnvironment(env = process.env, request = fetch) {
  assert.equal(env.NPM_PUBLISH_ENABLED, 'true', 'Configure the npm-publish environment and npm trusted publisher, then set NPM_PUBLISH_ENABLED=true');
  const response = await request(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/environments/npm-publish`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `Cannot verify npm-publish environment: HTTP ${response.status}`);
  const environment = await response.json();
  assert(environment.protection_rules?.some(rule => rule.type === 'required_reviewers' && rule.reviewers?.length), 'npm-publish must have at least one required reviewer; naming an environment alone does not create an approval gate');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkReleaseEnvironment();
  console.log('Publishing enabled and required reviewers configured. The publish job must now pass environment approval.');
}
