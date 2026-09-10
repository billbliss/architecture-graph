import { stringify, parse } from 'yaml';
// End-to-end lifecycle: only the packed public CLI and public package export run in consumers.
// Installs use a throwaway cache to avoid inherited cache metadata. The override is AG_NPM_CACHE, not
// npm_config_cache: npm exports its own config into script environments, so reading that variable
// would silently reuse the caller's cache and let stale metadata decide what this test installs.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temporary=mkdtempSync(join(tmpdir(),'ag-consumer-'));
const example=join(repo,'examples/hello-world');
const report=[];
const log=message=>{report.push(message);console.log(message);};
function run(cwd,bin,args,status=0) {
  const result=spawnSync(bin,args,{cwd,encoding:'utf8',env:{...process.env,npm_config_cache:process.env.AG_NPM_CACHE ?? join(temporary,'npm-cache')}});
  assert.equal(result.status,status,`${bin} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout+result.stderr;
}
function ag(cwd,...args) {return run(cwd,join(cwd,'node_modules/.bin/ag'),args);}
function save(cwd,graph) {writeFileSync(join(cwd,'architecture/graph.yaml'),stringify(graph));}
try {
  let tarball = process.env.AG_TARBALL && resolve(process.env.AG_TARBALL);
  if (!tarball) {
    execFileSync('npm', ['run','build'], {cwd:repo,stdio:'inherit'});
    const packed=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',temporary,'--ignore-scripts'],{cwd:repo,encoding:'utf8',env:{...process.env,npm_config_cache:process.env.AG_NPM_CACHE ?? join(temporary,'npm-cache')}}))[0];
    tarball=join(temporary,packed.filename);
  }
  const consumer=join(temporary,'isolated project');mkdirSync(consumer);
  writeFileSync(join(consumer,'package.json'),'{"name":"isolated-ag-consumer","private":true,"type":"module"}');
  run(consumer,'npm',['install','--prefer-offline','--save-dev','--ignore-scripts','--no-audit','--no-fund',tarball]);
  for (const path of ['LICENSE','bin/ag.js','src/index.ts','lib/index.js','lib/index.d.ts','lib/index.d.ts.map','schema/graph.schema.json','docs/getting-started.md','examples/hello-world/README.md','skills/architecture-graph/SKILL.md','skills/architecture-graph/references/modeling.md']) {
    assert(existsSync(join(consumer,'node_modules/@billbliss/architecture-graph',path)), `Missing packaged file: ${path}`);
  }
  assert(!existsSync(join(consumer,'node_modules/@billbliss/architecture-graph/.git')));
  assert(!existsSync(join(consumer,'node_modules/@billbliss/architecture-graph/examples/hello-world/node_modules')), 'The packaged example must not include installed dependencies');
  ag(consumer,'skill','install','--agent','codex');
  assert(!existsSync(join(consumer,'.claude')), 'Codex-only install must not install a Claude skill');
  assert(!existsSync(join(consumer,'ag.config.json')), 'Skill installation must not create a graph configuration');
  ag(consumer,'skill','install','--agent','claude');
  for (const dir of ['.claude/skills','.agents/skills']) assert(existsSync(join(consumer,dir,'architecture-graph/SKILL.md')), `Skill missing from ${dir}`);
  run(consumer,join(consumer,'node_modules/.bin/ag'),['skill','install','--agent','claude'],1);
  const codexSkill = join(consumer,'.agents/skills/architecture-graph');
  assert(existsSync(join(codexSkill,'references/modeling.md')));
  writeFileSync(join(codexSkill,'SKILL.md'), 'local Codex edit');
  run(consumer,join(consumer,'node_modules/.bin/ag'),['skill','install','--agent','codex'],1);
  assert.equal(readFileSync(join(codexSkill,'SKILL.md'),'utf8'),'local Codex edit');
  const replacement = JSON.parse(ag(consumer,'skill','install','--agent','codex','--force','--json'));
  assert.equal(replacement.installed[0].replaced,true);
  log('PASS: installed package places the shared skill in both the Claude Code and Codex project folders and refuses to overwrite a local copy.');
  ag(consumer,'init','--id','graph:hello-world','--title','Hello-world architecture');
  cpSync(join(example,'requirements.md'),join(consumer,'requirements.md'));
  const proposed=JSON.parse(readFileSync(join(example,'stages/proposed.json')));
  save(consumer,proposed);assert(!existsSync(join(consumer,'src')));
  ag(consumer,'validate');ag(consumer,'generate');ag(consumer,'check');
  log('PASS: installed tarball in separate consumer; design-only graph validates before application source exists.');
  mkdirSync(join(consumer,'src'));
  writeFileSync(join(consumer,'src/formatter.js'),'export function formatGreeting(name="") { return `Hello, ${name.trim() || "world"}!`; }\n');
  cpSync(join(example,'src/greeter.js'),join(consumer,'src/greeter.js'));
  cpSync(join(example,'src/cli.js'),join(consumer,'src/cli.js'));
  assert.equal(run(consumer,'node',['src/cli.js','Ada']).trim(),'Hello, Ada!');
  const implemented=JSON.parse(readFileSync(join(example,'stages/implemented.json')));
  save(consumer,implemented);ag(consumer,'validate');ag(consumer,'generate');
  const context=JSON.parse(ag(consumer,'context','--file','src/formatter.js','--json'));
  assert(context.nodes.some(n=>n.id==='contract:greeting'));
  assert(context.nodes.some(n=>n.id==='decision:tone'));
  writeFileSync(join(consumer,'context-before-change.json'),JSON.stringify(context,null,2));
  log('PASS: initial application runs; installed CLI retrieves formatter contract and unresolved tone decision before change.');
  cpSync(join(example,'src'),join(consumer,'src'),{recursive:true});
  cpSync(join(example,'app.test.js'),join(consumer,'app.test.js'));
  const final=parse(readFileSync(join(example,'architecture/graph.yaml'),'utf8'));
  save(consumer,final);run(consumer,'node',['--test','app.test.js']);
  ag(consumer,'validate');run(consumer,join(consumer,'node_modules/.bin/ag'),['check'],2);
  ag(consumer,'generate');ag(consumer,'check');
  assert.equal(run(consumer,'node',['src/cli.js','Ada','formal']).trim(),'Good day, Ada.');
  log('PASS: formal tone change updates code, declarations and guidance; stale generated output detected and repaired.');
  for(const [label,mutate] of [
    ['dangling relationship',g=>g.relationships[0].to='capability:absent'],
    ['duplicate identifier',g=>g.nodes.push(structuredClone(g.nodes[0]))],
    ['missing implemented reference',g=>g.nodes[0].references=[]],
    ['nonexistent source',g=>g.nodes[0].references=[{kind:'implementation',path:'src/absent.js'}]],
  ]) { const mutated=structuredClone(final);mutate(mutated);save(consumer,mutated);run(consumer,join(consumer,'node_modules/.bin/ag'),['validate'],1);log(`PASS: detects ${label}.`); }
  save(consumer,final);
  writeFileSync(join(consumer,'architecture/generated/guidance.md'),'stale');
  run(consumer,join(consumer,'node_modules/.bin/ag'),['check'],2);ag(consumer,'generate');ag(consumer,'check');
  writeFileSync(join(consumer,'src/formatter.js'),'export function formatGreeting() { return "WRONG"; }\n');
  ag(consumer,'validate');ag(consumer,'check');run(consumer,'node',['--test','app.test.js'],1);
  log('PASS: intentionally wrong implementation passes AG validation/check but fails application tests, demonstrating the assurance limit.');
  run(consumer,'node',['--input-type=module','-e','import { loadProject, getContext } from "@billbliss/architecture-graph"; if (!getContext(loadProject(), {id:"contract:greeting"}).nodes.length) process.exit(1);']);
  log('PASS: public ESM package export resolves in isolated consumer.');
  writeFileSync(join(consumer,'typed-consumer.mts'), `import { loadProject, getContext, type Graph, type ContextBundle } from '@billbliss/architecture-graph';
const graph: Graph = loadProject().graph;
const context: ContextBundle = getContext(loadProject(), {module: 'module:greetings'});
// @ts-expect-error An invalid option must be rejected by the published declarations.
getContext(loadProject(), {depth: 'two'});
console.log(graph.id, context.truncated);
`);
  run(consumer,process.execPath,[join(repo,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','typed-consumer.mts']);
  log('PASS: installed public TypeScript declarations accept valid usage and reject an invalid option.');
  // Verify the checked-in example against the same package, without changing its manifest.
  run(example,'npm',['install','--prefer-offline','--no-save','--package-lock=false','--ignore-scripts','--no-audit','--no-fund',tarball]);
  run(example,'npm',['test']);ag(example,'validate');ag(example,'generate');ag(example,'check');
  log('PASS: checked-in hello-world uses installed public CLI and passes application tests.');
  if (process.argv.includes('--record')) {
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(join(repo, 'docs/history/latest-consumer-run.md'),
      `# Package and example check — ${date}\n\nThis run checked whether a separate project could install the package and use AG while a design evolved into working code. Run \`npm run verify\` for a fresh check; this is a saved record, not a live status page.\n\nRuntime: Node ${process.version}.\n\n${report.map(s => '- ' + s).join('\n')}\n\nThe intentionally broken formatter shows the limit: consistent design records do not establish correct application behavior.\n`);
  }

} finally {rmSync(temporary,{recursive:true,force:true});}
