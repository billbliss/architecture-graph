#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { AGError, VERSION, LIMIT, initProject, loadProject, getContext, formatContext, summarize, syncArtifacts, installSkill, SKILL_AGENTS, type SkillAgent } from './index.js';

const help = `AG ${VERSION} — portable architectural declarations
Usage:
  ag init [--root DIR] [--id graph:project] [--title TITLE]
  ag skill install --agent claude|codex[,...] [--root DIR] [--force]
  ag validate [--config FILE] [--json]
  ag context (--id ID | --file PATH | --query TEXT | --module ID | --guardrail ID) [--depth 0..3] [--max-nodes N] [--max-relationships N] [--config FILE] [--json]
  ag summary [--config FILE]
  ag generate [--config FILE]
  ag check [--config FILE]
  ag --version
Paths in declarations and --file are relative to the config directory.
skill install copies the bundled instructions into the agent's project skill folder; it does not create a graph.
${LIMIT}`;
let asJSON = false;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    module: { type: 'string' }, guardrail: { type: 'string' }, agent: { type: 'string' }, force: { type: 'boolean' }, 'max-nodes': { type: 'string' }, 'max-relationships': { type: 'string' }, config: { type: 'string' }, root: { type: 'string' }, id: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, query: { type: 'string' }, depth: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' },
  }});
  asJSON = values.json ?? false;
  if (values.version) console.log(VERSION);
  else if (values.help || !positionals.length) console.log(help);
  else {
    const command = positionals[0]!;
    const allowed: Record<string, string[]> = { skill: ['root','agent','force','json'], init: ['root','id','title'], validate: ['config','json'], context: ['config','json','id','file','query','depth','module','guardrail','max-nodes','max-relationships'], summary: ['config','json'], generate: ['config','json'], check: ['config','json'] };
    const positionalCount: Record<string, number> = { skill: 2 };
    if (!allowed[command] || positionals.length !== (positionalCount[command] ?? 1)) throw new Error('Unknown command or positional argument; use ag --help');
    for (const key of Object.keys(values)) if (!allowed[command]!.includes(key)) throw new Error(`--${key} is not valid for ${command}`);
    if (command === 'skill') {
      if (positionals[1] !== 'install') throw new Error('Unknown skill command; use ag skill install --agent claude|codex');
      if (!values.agent) throw new Error(`--agent is required; choose ${SKILL_AGENTS.join(', ')}, or both separated by a comma`);
      const agents = values.agent.split(',').map(name => name.trim()).filter(Boolean) as SkillAgent[];
      const installed = installSkill(values.root, agents, { force: values.force ?? false });
      if (asJSON) console.log(JSON.stringify({ installed, limitation: LIMIT }, null, 2));
      else for (const item of installed) console.log(`${item.replaced ? 'Replaced' : 'Installed'} the ${item.agent} skill at ${item.path}. Restart the agent if it does not appear. Installing does not create or update a graph.`);
    } else if (command === 'init') {
      initProject(values.root, { id: values.id, title: values.title });
      console.log('Initialized empty declarations. Read requirements and model scope before generating guidance.');
    } else {
      const project = loadProject(values.config);
      if (command === 'validate') console.log(asJSON ? JSON.stringify({ valid: true, limitation: LIMIT }) : `Valid declarations. ${LIMIT}`);
      if (command === 'summary') console.log(JSON.stringify(summarize(project), null, 2));
      if (command === 'context') {
        const context = getContext(project, { id: values.id, file: values.file, query: values.query, module: values.module, guardrail: values.guardrail, maxNodes: values['max-nodes'] === undefined ? undefined : Number(values['max-nodes']), maxRelationships: values['max-relationships'] === undefined ? undefined : Number(values['max-relationships']), depth: values.depth === undefined ? 1 : Number(values.depth) });
        console.log(asJSON ? JSON.stringify(context, null, 2) : formatContext(context));
      }
      if (command === 'generate' || command === 'check') {
        const result = syncArtifacts(project, { check: command === 'check' });
        console.log(JSON.stringify({ ...result, action: command }, null, 2));
        if (command === 'check' && result.drift.length) process.exitCode = 2;
      }
    }
  }
} catch (caught) {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  console.error(asJSON ? JSON.stringify({ valid: false, errors: (error instanceof AGError ? error.errors : undefined) ?? [{ code: 'input', message: error.message }] }) : error.message);
  process.exitCode = 1;
}
