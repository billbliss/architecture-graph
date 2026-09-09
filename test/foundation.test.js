import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { initProject, loadProject, getContext, syncArtifacts, renderArtifacts, validateGraph, parseDeclarations } from '../lib/index.js';

function project(t, graph) {
  const root = mkdtempSync(join(tmpdir(), 'ag-foundation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  initProject(root);
  writeFileSync(join(root, 'requirements.md'), 'Real design reference');
  const save = () => writeFileSync(join(root, 'architecture/graph.yaml'), stringify(graph, { aliasDuplicateObjects: false }));
  save();
  return { root, graph, save, load: (options) => loadProject(join(root, 'ag.config.json'), options) };
}
const reference = [{ kind: 'design', path: 'requirements.md' }];
const node = (id, kind = 'component', extra = {}) => ({ id: `${kind}:${id}`, kind, name: id, description: `Responsibility ${id}`, status: 'proposed', references: structuredClone(reference), ...extra });
const edge = (id, from, to, kind = 'depends_on') => ({ id: `relationship:${id}`, kind, from, to, description: 'An intentional connection', status: 'proposed', references: [] });
const graph = (nodes = [], relationships = [], extra = {}) => ({ schemaVersion: '1', id: 'graph:test', title: 'Test architecture', description: 'A bounded test design', nodes, relationships, ...extra });
function content(context) {
  const { readSource, fallbackReason, ...rest } = context;
  return rest;
}
test('default is one YAML file; authored comments survive all read/generation operations', t => {
  const p = project(t, graph([node('service')]));
  const path = join(p.root, 'architecture/graph.yaml');
  writeFileSync(path, '# Keep the reason for this decision.\n' + readFileSync(path,'utf8'));
  const before = readFileSync(path,'utf8');
  syncArtifacts(p.load());getContext(p.load(),{id:'component:service'});
  assert.equal(readFileSync(path,'utf8'),before);
  assert(!existsSync(join(p.root,'architecture/modules')));
});
test('YAML and legacy JSON have equivalent meaning; malformed YAML and duplicate keys are rejected', t => {
  const g = graph([node('service')]); const p = project(t,g);
  assert.deepEqual(parseDeclarations(stringify(g),'graph.yaml'),parseDeclarations(JSON.stringify(g),'graph.json'));
  for (const bad of ['a: 1\na: 2\n','a: [','a: &a [*a]','a: !unexpected value','---\na: 1\n---\nb: 2']) {
    assert.throws(() => parseDeclarations(bad,'graph.yaml'));
  }
  assert.throws(() => parseDeclarations('{"a":1,"a":2}','graph.json'));
  assert.throws(() => parseDeclarations('{"a":1,}','graph.json'));
  assert.equal(p.load().config.graph,'architecture/graph.yaml');
});
test('compiled context equals fallback and never supersedes changed canonical records', t => {
  const p = project(t,graph([node('a'),node('b')],[edge('ab','component:a','component:b')]));
  const fallback = getContext(p.load(),{id:'component:a'});
  assert.equal(fallback.readSource,'canonical_fallback');
  syncArtifacts(p.load());
  const compiled = getContext(p.load(),{id:'component:a'});
  assert.equal(compiled.readSource,'compiled_artifact');
  assert.deepEqual(content(compiled),content(fallback));
  assert.deepEqual(content(getContext(p.load({forceCanonical:true}),{id:'component:a'})),content(fallback));
  p.graph.nodes[1].description='Changed responsibility';p.save();
  const fresh = getContext(p.load(),{id:'component:b'});
  assert.equal(fresh.readSource,'canonical_fallback');assert.match(fresh.fallbackReason,/stale/);
  assert.equal(fresh.nodes.find(n=>n.id==='component:b').description,'Changed responsibility');
  assert(syncArtifacts(p.load(),{check:true}).drift.includes('graph-index.json'));
});
test('corrupt or missing compiled indexes fall back and generation repairs them', t => {
  const p = project(t,graph([node('a')]));syncArtifacts(p.load());
  const path=join(p.root,'architecture/generated/neighborhood-index.json');
  writeFileSync(path,'{broken');
  assert.equal(p.load().readSource,'canonical_fallback');
  assert(syncArtifacts(p.load(),{check:true}).drift.includes('neighborhood-index.json'));
  syncArtifacts(p.load());assert.equal(p.load().readSource,'compiled_artifact');
  rmSync(path);assert.equal(p.load().readSource,'canonical_fallback');
});
test('source locators remain stable through insertion, ordering and comments', t => {
  const p=project(t,graph([node('a'),node('b')],[edge('ab','component:a','component:b')]));
  const before=p.load().index.locators['component:b'];
  p.graph.nodes.unshift(node('first'));p.graph.nodes.reverse();p.save();
  assert.deepEqual(p.load().index.locators['component:b'],before);
  assert.deepEqual(before,{path:'architecture/graph.yaml',section:'nodes',objectId:'component:b'});
});
test('logical modules validate exports/imports without splitting the authored file', t => {
  const g=graph([node('a','component',{module:'module:a'}),node('b','component',{module:'module:b'})],[edge('ab','component:a','component:b')],{
    modules:[{id:'module:a',name:'A',description:'Caller',exports:[],imports:['component:b']},{id:'module:b',name:'B',description:'Provider',exports:['component:b'],imports:[]}],
  });
  const p=project(t,g);const c=getContext(p.load(),{module:'module:a'});
  assert.deepEqual(c.nodes.map(n=>n.id),['component:a','component:b']);
  assert.equal(c.crossModuleDependencies[0].fromModule,'module:a');
  assert.equal(p.load().index.modules['module:a'].relationshipIds[0],'relationship:ab');
  g.modules[0].imports=[];
  assert(validateGraph(g,p.root).some(e=>e.code==='cross-module'));
  g.modules[1].exports=['component:a'];
  assert(validateGraph(g,p.root).some(e=>e.code==='module-export'));
});
test('original AG vocabulary and explicit guardrail lookup remain available', t => {
  const g=graph([
    node('pipeline','workflow'),node('payload','data_object'),node('format','constraint',{classification:'guardrail'}),node('adapter','adapter'),node('audit','evidence_surface'),
  ],[edge('guard','workflow:pipeline','constraint:format','guarded_by'),edge('preserve','adapter:adapter','data_object:payload','preserves')]);
  g.nodes[1].id='data-object:payload';g.relationships[1].to='data-object:payload';
  const p=project(t,g);
  assert.deepEqual(validateGraph(g,p.root),[]);
  const c=getContext(p.load(),{guardrail:'constraint:format'});
  assert(c.nodes.some(n=>n.id==='workflow:pipeline'));
  assert(c.relationships.some(e=>e.kind==='guarded_by'));
});
test('5,000-node graph uses focused indexes and produces a bounded briefing', t => {
  const nodes=Array.from({length:5000},(_,i)=>node(String(i).padStart(5,'0')));
  const edges=nodes.slice(1).map((n,i)=>edge(`chain-${i}`,nodes[i].id,n.id));
  const p=project(t,graph(nodes,edges));
  const loaded=p.load();
  const c=getContext(loaded,{id:'component:02500',depth:1});
  assert.equal(c.nodes.length,3);assert.equal(c.relationships.length,2);
  assert(c.stats.relationshipsExamined<10);assert.equal(c.truncated,false);
  const artifacts=renderArtifacts(loaded);
  assert(artifacts['guidance.md'].length<5000);
  assert.equal(Object.keys(loaded.index.sources['requirements.md']).length,2);
  syncArtifacts(loaded);assert.equal(p.load().readSource,'compiled_artifact');
});
test('high fanout and broad source queries report truncation instead of silent omissions', t => {
  const nodes=Array.from({length:1000},(_,i)=>node(String(i)));
  const edges=nodes.slice(1).map((n,i)=>edge(`fan-${i}`,nodes[0].id,n.id));
  const p=project(t,graph(nodes,edges));
  for(const options of [{id:'component:0'},{file:'requirements.md'}]) {
    const c=getContext(p.load(),{...options,maxNodes:8,maxRelationships:12});
    assert(c.nodes.length<=8);assert(c.relationships.length<=12);assert(c.stats.relationshipsExamined<=12);
    assert.equal(c.truncated,true);assert.match(c.warnings[0],/incomplete/);
  }
});
