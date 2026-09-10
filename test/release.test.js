import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { releaseArtifact, publishedVersion } from '../scripts/release-artifact.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ag-release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'dist'));
  const metadata = { name: '@billbliss/architecture-graph', version: '0.3.1', filename: 'billbliss-architecture-graph-0.3.1.tgz', commit: 'abc', sha256: createHash('sha256').update('tested bytes').digest('hex') };
  writeFileSync(join(root, 'package.json'), JSON.stringify(metadata));
  writeFileSync(join(root, 'dist/package-metadata.json'), JSON.stringify(metadata));
  writeFileSync(join(root, 'dist', metadata.filename), 'tested bytes');
  const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/v0.3.1', GITHUB_REPOSITORY: 'billbliss/architecture-graph', GITHUB_SHA: 'abc' };
  return { root, env, metadata };
}
test('release accepts only the tested bytes for the matching tag, repo and commit', t => {
  const {root,env,metadata}=fixture(t);
  assert.equal(releaseArtifact(root,env).version,'0.3.1');
  for(const [key,value] of [['GITHUB_EVENT_NAME','workflow_dispatch'],['GITHUB_REF','refs/heads/main'],['GITHUB_REF','refs/tags/v0.3.2'],['GITHUB_REPOSITORY','someone/fork'],['GITHUB_SHA','different']]) assert.throws(()=>releaseArtifact(root,{...env,[key]:value}));
  writeFileSync(join(root,'dist',metadata.filename),'changed');
  assert.throws(()=>releaseArtifact(root,env),/checksum mismatch/);
});
test('existing release is reusable only when registry bytes match; errors do not mean absent', async t => {
  const {root,env}=fixture(t);const artifact=releaseArtifact(root,env);
  const request=(status,body)=>async()=>({status,ok:status===200,json:async()=>body});
  assert.equal(await publishedVersion(artifact,request(404)),null);
  const matching={name:artifact.name,version:artifact.version,dist:{integrity:artifact.integrity}};
  assert.deepEqual(await publishedVersion(artifact,request(200,matching)),matching);
  await assert.rejects(publishedVersion(artifact,request(200,{...matching,dist:{integrity:'different'}})),/differs/);
  await assert.rejects(publishedVersion(artifact,request(503)),/503/);
});
test('publishing requires the tag-only approval job and downloads the tested artifact',()=>{
  const workflow=parse(readFileSync(new URL('../.github/workflows/package.yml',import.meta.url),'utf8'));
  const publish=workflow.jobs.publish;
  assert.equal(publish.environment,'npm-publish');
  assert.deepEqual(publish.needs,['package','release-ready']);
  assert(publish.if.includes("github.event_name == 'push'") && publish.if.includes('refs/tags/v'));
  assert.equal(publish.permissions['id-token'],'write');
  assert(publish.steps.some(step=>step.uses?.startsWith('actions/download-artifact@')));
  assert(!publish.steps.some(step=>step.run?.includes('npm run package')));
  for(const [name,job]of Object.entries(workflow.jobs))if(name!=='publish')assert.notEqual(job.permissions?.['id-token'],'write');
});

test('release configuration fails closed without enablement or required reviewers',async()=>{
  const {checkReleaseEnvironment}=await import('../scripts/check-release-environment.mjs');
  await assert.rejects(checkReleaseEnvironment({},()=>{throw new Error('Must not request before enablement');}),/NPM_PUBLISH_ENABLED/);
  const env={NPM_PUBLISH_ENABLED:'true',GITHUB_REPOSITORY:'billbliss/architecture-graph'};
  for(const rules of [[],[{type:'wait_timer'}],[{type:'required_reviewers',reviewers:[]}]])await assert.rejects(checkReleaseEnvironment(env,async()=>({ok:true,json:async()=>({protection_rules:rules})})),/required reviewer/);
  await assert.rejects(checkReleaseEnvironment(env,async()=>({ok:false,status:403})),/403/);
  await checkReleaseEnvironment(env,async()=>({ok:true,json:async()=>({protection_rules:[{type:'required_reviewers',reviewers:[{type:'User'}]}]})}));
});
