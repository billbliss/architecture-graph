import { existsSync, readFileSync } from 'node:fs';
import type { Config } from './schema.js';
import type { GraphIndex } from './model.js';
import { VERSION } from './model.js';
import { digest, json, stable } from './serialization.js';
import { localPath, messageOf } from './paths.js';

const files = {
  'graph-index.json': ['nodes', 'relationships'],
  'source-context-index.json': ['sources'],
  'neighborhood-index.json': ['neighborhoods'],
  'module-ownership-map.json': ['modules'],
  'cross-module-dependency-index.json': ['crossModule'],
  'guardrail-index.json': ['guardrails'],
  'graph-source-map.json': ['locators'],
} as const;
export function compiledArtifacts(index: GraphIndex, graphId: string, declarationDigest: string): Record<string, string> {
  const artifacts: Record<string, string> = {};
  const checksums: Record<string, string> = {};
  for (const [file, keys] of Object.entries(files)) {
    const data = Object.fromEntries(keys.map(key => [key, index[key]]));
    artifacts[file] = json(stable(data));
    checksums[file] = digest(artifacts[file]!);
  }
  artifacts['compilation-metadata.json'] = json({ artifactVersion: '2', toolVersion: VERSION, graphId, declarationDigest, checksums });
  return artifacts;
}
export function readCompiled(root: string, config: Config, graphId: string, expectedDigest: string): { index: GraphIndex | null; reason: string | null } {
  try {
    const metaPath = localPath(root, `${config.generated}/compilation-metadata.json`);
    if (!existsSync(metaPath)) return { index: null, reason: 'Compiled indexes are missing' };
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
    if (meta.artifactVersion !== '2' || meta.toolVersion !== VERSION || meta.graphId !== graphId || meta.declarationDigest !== expectedDigest) {
      return { index: null, reason: 'Compiled indexes are stale or belong to another graph/tool version' };
    }
    const checksums = meta.checksums as Record<string, string> | undefined;
    const result: Partial<GraphIndex> = {};
    for (const [file, keys] of Object.entries(files)) {
      const content = readFileSync(localPath(root, `${config.generated}/${file}`), 'utf8');
      if (checksums?.[file] !== digest(content)) throw new Error(`Checksum mismatch: ${file}`);
      const parsed = JSON.parse(content) as Record<string, unknown>;
      for (const key of keys) {
        if (!Object.hasOwn(parsed, key) || parsed[key] === null || typeof parsed[key] !== 'object' || Array.isArray(parsed[key])) {
          throw new Error(`Missing index table: ${key}`);
        }
        Object.assign(result, { [key]: Object.assign(Object.create(null), parsed[key]) });
      }
    }
    return { index: result as GraphIndex, reason: null };
  } catch (error) { return { index: null, reason: `Compiled indexes could not be read: ${messageOf(error)}` }; }
}
