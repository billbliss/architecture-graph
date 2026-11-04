// Bundles the repository's examples (examples/catalog.json) into src/generated/examples/ for the viewer.
//
// Each bundle is a recording of the files the viewer's own load path touches: the configuration, the
// graph, and whatever validation reads or checks (sidecars, their $ref targets, referenced files).
// The script runs that load path here in Node against the real files, so a bundle holds exactly what
// the browser will ask for, and an example that does not validate fails the build.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeFileSource } from '@billbliss/architecture-graph';
import { loadFromSource } from '../src/load/project.ts';

const viewer = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(viewer, '..');
const out = resolve(viewer, 'src/generated/examples');
const GITHUB_REPO = 'https://github.com/billbliss/architecture-graph';

function commit() {
  const fromCloudflare = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA;
  if (fromCloudflare) return fromCloudflare;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    return 'main';
  }
}

/** Wraps a file source and records every answer it gives. */
function recording(source) {
  const files = {};
  const kinds = {};
  return {
    files,
    kinds,
    source: {
      kind(path) {
        const kind = source.kind(path);
        kinds[path] = kind;
        return kind;
      },
      read(path) {
        const text = source.read(path);
        files[path] = text;
        return text;
      },
    },
  };
}

const catalog = JSON.parse(readFileSync(resolve(repo, 'examples/catalog.json'), 'utf8'));
const sha = commit();
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of catalog) {
  const root = posix.dirname(entry.config);
  const configName = posix.basename(entry.config);
  const record = recording(nodeFileSource(resolve(repo, root)));
  const loaded = await loadFromSource(record.source, configName);
  if (loaded.problem) throw new Error(`${entry.name}: ${loaded.problem}`);
  if (loaded.diagnostics.length) {
    const lines = loaded.diagnostics.map(item => `${item.code} ${item.at}: ${item.message}`).join('\n');
    throw new Error(`${entry.name} does not validate:\n${lines}`);
  }
  // Files read only to answer existence checks are not needed; a kind of `file` is recorded for them.
  const bundle = {
    name: entry.name,
    title: entry.title,
    summary: entry.summary,
    config: configName,
    files: record.files,
    kinds: record.kinds,
    sourceBase: `${GITHUB_REPO}/blob/${sha}/${root === '.' ? '' : root + '/'}`,
  };
  writeFileSync(resolve(out, `${entry.name}.json`), JSON.stringify(bundle));
  console.log(`Bundled ${entry.name}: ${loaded.graph.nodes.length} nodes, ${Object.keys(record.files).length} files read`);
}

writeFileSync(resolve(out, 'index.json'), JSON.stringify(catalog.map(({ name, title, summary }) => ({ name, title, summary })), null, 2) + '\n');
