#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { VERSION, LIMIT, initProject, loadProject, getContext, formatContext, summarize, syncArtifacts } from '../src/index.js';

const help = `AG ${VERSION} — portable architectural declarations
Usage:
  ag init [--root DIR] [--id graph:project] [--title TITLE]
  ag validate [--config FILE] [--json]
  ag context (--id ID | --file PATH | --query TEXT) [--depth 0..3] [--config FILE] [--json]
  ag summary [--config FILE]
  ag generate [--config FILE]
  ag check [--config FILE]
  ag --version
Paths in declarations and --file are relative to the config directory.
${LIMIT}`;
let asJSON = false;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string' }, root: { type: 'string' }, id: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, query: { type: 'string' }, depth: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' },
  }});
  asJSON = values.json ?? false;
  if (values.version) console.log(VERSION);
  else if (values.help || !positionals.length) console.log(help);
  else {
    const [command] = positionals;
    const allowed = { init: ['root','id','title'], validate: ['config','json'], context: ['config','json','id','file','query','depth'], summary: ['config','json'], generate: ['config','json'], check: ['config','json'] };
    if (!allowed[command] || positionals.length !== 1) throw new Error('Unknown command or positional argument; use ag --help');
    for (const key of Object.keys(values)) if (!allowed[command].includes(key)) throw new Error(`--${key} is not valid for ${command}`);
    if (command === 'init') {
      initProject(values.root, { id: values.id, title: values.title });
      console.log('Initialized empty declarations. Read requirements and model scope before generating guidance.');
    } else {
      const project = loadProject(values.config);
      if (command === 'validate') console.log(asJSON ? JSON.stringify({ valid: true, limitation: LIMIT }) : `Valid declarations. ${LIMIT}`);
      if (command === 'summary') console.log(JSON.stringify(summarize(project), null, 2));
      if (command === 'context') {
        const context = getContext(project, { id: values.id, file: values.file, query: values.query, depth: values.depth === undefined ? 1 : Number(values.depth) });
        console.log(asJSON ? JSON.stringify(context, null, 2) : formatContext(context));
      }
      if (command === 'generate' || command === 'check') {
        const result = syncArtifacts(project, { check: command === 'check' });
        console.log(JSON.stringify({ ...result, action: command }, null, 2));
        if (command === 'check' && result.drift.length) process.exitCode = 2;
      }
    }
  }
} catch (error) {
  console.error(asJSON ? JSON.stringify({ valid: false, errors: error.errors ?? [{ code: 'input', message: error.message }] }) : error.message);
  process.exitCode = 1;
}
