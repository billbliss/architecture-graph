import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { VERSION, initProject, loadProject, validateGraph, getContext, syncArtifacts, installSkill, SKILL_TARGETS, SKILL_NAME } from '../lib/index.js';
const fixture = JSON.parse(readFileSync(new URL('../examples/hello-world/stages/proposed.json', import.meta.url)));
function setup(t) {
  const root = mkdtempSync(join(tmpdir(),'ag-unit-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  initProject(root); writeFileSync(join(root,'ag.config.json'), JSON.stringify({configVersion:'1',graph:'architecture/graph.json',generated:'architecture/generated'})); writeFileSync(join(root,'requirements.md'),'Actual requirements');
  const graph = structuredClone(fixture);
  const save = () => writeFileSync(join(root,'architecture/graph.json'), JSON.stringify(graph));
  save(); return { root, graph, save, load: () => loadProject(join(root,'ag.config.json')) };
}
test('documents-only graph remains valid and uncertainty is retrievable', t => {
  const p = setup(t); assert.deepEqual(validateGraph(p.graph,p.root),[]);
  const c = getContext(p.load(),{id:'contract:greeting'});
  assert(c.nodes.some(n => n.id === 'decision:tone' && n.status === 'unresolved'));
  assert(c.nodes.some(n => n.id === 'component:formatter'));
});
test('structural failures expose distinct actionable diagnostics', t => {
  const p = setup(t);
  p.graph.nodes.push(structuredClone(p.graph.nodes[0]));
  p.graph.relationships[0].to='capability:missing';
  p.graph.nodes[1].status='implemented';
  const codes=validateGraph(p.graph,p.root).map(e=>e.code);
  for(const code of ['duplicate-id','dangling-relationship','implemented-source']) assert(codes.includes(code));
});
test('strict schema rejects misspellings, invalid versions and malformed input', t => {
  const p = setup(t);
  for (const graph of [null, {...p.graph,schemaVersion:'999'}, {...p.graph,typo:true}, {...p.graph,nodes:[{id:'bad'}]}]) assert(validateGraph(graph,p.root).some(e=>e.code==='schema'));
});
test('real references must be files inside the consumer; symlinks cannot escape', t => {
  const p=setup(t);
  symlinkSync('/tmp',join(p.root,'outside'));
  for(const path of ['missing.js','architecture','../external.js','outside/file','/etc/passwd']) {
    p.graph.nodes[0].references=[{kind:'implementation',path}];
    assert(validateGraph(p.graph,p.root).some(e=>e.code==='reference'),path);
  }
});
test('typed relations, conflicting authorities and ownership cycles are detected', t => {
  const p=setup(t);
  p.graph.relationships[0].to='contract:greeting';
  const base=p.graph.relationships[3];
  p.graph.relationships.push({...base,id:'relationship:other-authority',from:'component:greeter'});
  for(const [from,to,id] of [['component:greeter','component:formatter','a'],['component:formatter','component:greeter','b']]) p.graph.relationships.push({...base,id:'relationship:'+id,kind:'owns',from,to});
  const codes=validateGraph(p.graph,p.root).map(e=>e.code);
  for(const code of ['relationship-kind','conflicting-declaration','ownership-cycle']) assert(codes.includes(code));
});
test('drift is detected read-only, repaired, and independent of object key order', t=>{
  const p=setup(t);const project=p.load();
  assert.equal(syncArtifacts(project,{check:true}).drift.length,10);
  syncArtifacts(project);assert.deepEqual(syncArtifacts(project,{check:true}).drift,[]);
  const output=join(p.root,'architecture/generated/guidance.md');
  writeFileSync(output,'stale'); assert(syncArtifacts(project,{check:true}).drift.includes('guidance.md'));
  assert.equal(readFileSync(output,'utf8'),'stale');syncArtifacts(project);
  p.graph.nodes.reverse();p.save();assert.deepEqual(syncArtifacts(p.load(),{check:true}).drift,[]);
  p.graph.nodes[0].description='Changed intent';p.save();assert.equal(syncArtifacts(p.load(),{check:true}).drift.length >= 2,true);
});
test('context honors depth, source lookup and relationship lookup without generated data',t=>{
  const p=setup(t);const project=p.load();
  assert.equal(getContext(project,{id:'surface:cli',depth:0}).nodes.length,1);
  assert(getContext(project,{id:'surface:cli',depth:2}).nodes.some(n=>n.id==='component:formatter'));
  assert.equal(getContext(project,{file:'requirements.md',depth:0}).nodes.length,p.graph.nodes.length);
  assert.equal(getContext(project,{id:'relationship:authority',depth:0}).nodes.length,2);
  assert.throws(()=>getContext(project,{id:'nope'}),/No architecture/);
  assert.throws(()=>getContext(project,{id:'surface:cli',depth:99}),/Depth/);
});
test('explicit config works without layout defaults; output cannot alias canonical input',t=>{
  const p=setup(t);mkdirSync(join(p.root,'model'));
  writeFileSync(join(p.root,'model/declarations.json'),JSON.stringify(p.graph));
  writeFileSync(join(p.root,'custom.json'),JSON.stringify({configVersion:'1',graph:'model/declarations.json',generated:'derived'}));
  assert.equal(loadProject(join(p.root,'custom.json')).graph.id,p.graph.id);
  writeFileSync(join(p.root,'custom.json'),JSON.stringify({configVersion:'1',graph:'model/declarations.json',generated:'model'}));
  assert.throws(()=>loadProject(join(p.root,'custom.json')),/Generated directory/);
});
test('init refuses to overwrite existing declarations',t=>{
  const p=setup(t); const before=readFileSync(join(p.root,'architecture/graph.json'),'utf8');
  assert.throws(()=>initProject(p.root),/overwrite/);assert.equal(readFileSync(join(p.root,'architecture/graph.json'),'utf8'),before);
});
test('valid declaration does not check code behavior',t=>{
  const p=setup(t);writeFileSync(join(p.root,'wrong.js'),'export const greet = () => "WRONG";');
  p.graph.nodes[1].status='implemented';p.graph.nodes[1].references=[{kind:'implementation',path:'wrong.js'}];
  assert.deepEqual(validateGraph(p.graph,p.root),[]);
});
test('tool, manifest, plugin and bundled skill versions stay compatible', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const skill = readFileSync(new URL('../skills/architecture-graph/SKILL.md', import.meta.url),'utf8');
  const plugin = JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url)));
  const marketplace = JSON.parse(readFileSync(new URL('../.claude-plugin/marketplace.json', import.meta.url)));
  assert.equal(pkg.version, VERSION);
  assert(skill.includes(`version: "${VERSION}"`));
  assert.equal(pkg.bin.ag, 'bin/ag.js');
  // Claude Code discovers a plugin's skills under skills/; the manifest only names the plugin.
  assert.equal(plugin.name, SKILL_NAME);
  assert.equal(plugin.version, VERSION);
  assert(marketplace.plugins.some(entry => entry.name === plugin.name && entry.source === './'));
});
test('installing the skill serves each agent without replacing local edits', t => {
  const root = mkdtempSync(join(tmpdir(),'ag-skill-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  const installed = installSkill(root, ['claude','codex']);
  assert.deepEqual(installed.map(i => i.path).sort(), Object.values(SKILL_TARGETS).map(dir => `${dir}/${SKILL_NAME}`).sort());
  assert(installed.every(i => i.replaced === false));
  for (const dir of Object.values(SKILL_TARGETS)) {
    assert(existsSync(join(root,dir,SKILL_NAME,'SKILL.md')));
    assert(existsSync(join(root,dir,SKILL_NAME,'references/modeling.md')));
    for (const file of ['SKILL.md', 'references/modeling.md']) {
      const installedFile = join(root,dir,SKILL_NAME,file);
      for (const [,target] of readFileSync(installedFile,'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        if (!target.includes('://') && !target.startsWith('#')) assert(existsSync(join(dirname(installedFile),target)), `Broken installed skill link: ${target}`);
      }
    }
  }
  const edited = join(root,SKILL_TARGETS.claude,SKILL_NAME,'SKILL.md');
  writeFileSync(edited,'local edit');
  assert.throws(() => installSkill(root, ['claude']), /overwrite/);
  assert.equal(readFileSync(edited,'utf8'),'local edit');
  const replaced = installSkill(root, ['claude'], { force: true });
  assert.equal(replaced[0].replaced, true);
  assert(readFileSync(edited,'utf8').includes('name: architecture-graph'));
});
test('skill installation rejects an unknown agent before writing anything', t => {
  const root = mkdtempSync(join(tmpdir(),'ag-skill-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  assert.throws(() => installSkill(root, ['claude','gemini']), /Unknown agent/);
  assert(!existsSync(join(root,SKILL_TARGETS.claude)));
});
test('generated symlinks are rejected before any output is overwritten', t => {
  const p = setup(t); const project = p.load();
  mkdirSync(join(p.root,'architecture/generated'));
  writeFileSync(join(p.root,'keep.md'),'original');
  symlinkSync(join(p.root,'keep.md'),join(p.root,'architecture/generated/guidance.md'));
  assert.throws(() => syncArtifacts(project), /Symlink/);
  assert.equal(readFileSync(join(p.root,'keep.md'),'utf8'),'original');
});

test('Codex installation preflights all destinations and rejects symlinks even with force', t => {
  const root = mkdtempSync(join(tmpdir(), 'ag-skill-preflight-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  installSkill(root, ['codex']);
  const edited = join(root, '.agents/skills/architecture-graph/SKILL.md');
  writeFileSync(edited, 'local Codex edits');
  assert.throws(() => installSkill(root, ['claude', 'codex']), /overwrite/);
  assert(!existsSync(join(root, '.claude')));
  assert.equal(readFileSync(edited, 'utf8'), 'local Codex edits');
  rmSync(join(root, '.agents'), { recursive: true });
  mkdirSync(join(root, 'external'));
  symlinkSync(join(root, 'external'), join(root, '.agents'));
  assert.throws(() => installSkill(root, ['claude', 'codex'], { force: true }), /Symlink/);
  assert(!existsSync(join(root, '.claude')));
  assert(!existsSync(join(root, 'external/skills')));
});

test('agent validation rejects inherited object properties before creating the root', t => {
  const parent = mkdtempSync(join(tmpdir(), 'ag-skill-agent-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  for (const agent of ['constructor', '__proto__', 'toString']) {
    const root = join(parent, agent);
    assert.throws(() => installSkill(root, [agent]), /Unknown agent/);
    assert(!existsSync(root));
  }
});
