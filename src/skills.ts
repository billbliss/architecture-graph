import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localPath } from './paths.js';

/** The bundled skill is one folder of instructions; each agent reads it from its own location. */
export const SKILL_NAME = 'architecture-graph';
export const SKILL_TARGETS = { claude: '.claude/skills', codex: '.agents/skills' } as const;
export type SkillAgent = keyof typeof SKILL_TARGETS;
export const SKILL_AGENTS = Object.keys(SKILL_TARGETS) as SkillAgent[];

export interface SkillInstallation { agent: SkillAgent; path: string; replaced: boolean }

/** Locate the skill folder shipped inside this package, whether running from lib/ or src/. */
export function bundledSkillPath(): string {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
  if (!existsSync(resolve(path, 'SKILL.md'))) {
    throw new Error(`Bundled skill is missing from this installation: ${path}`);
  }
  return path;
}

/**
 * Copy the bundled skill into each agent's project skill directory. Copying installs the
 * instructions; it does not run them, and it does not create or change a graph.
 */
export function installSkill(root = '.', agents: SkillAgent[] = SKILL_AGENTS, { force = false }: { force?: boolean } = {}): SkillInstallation[] {
  if (!agents.length) throw new Error(`Name at least one agent: ${SKILL_AGENTS.join(', ')}`);
  for (const agent of agents) {
    if (!Object.hasOwn(SKILL_TARGETS, agent)) throw new Error(`Unknown agent ${agent}; expected ${SKILL_AGENTS.join(' or ')}`);
  }
  const source = bundledSkillPath();
  mkdirSync(root, { recursive: true });
  const base = realpathSync(root);
  const planned = [...new Set(agents)].map(agent => {
    const relative = `${SKILL_TARGETS[agent]}/${SKILL_NAME}`;
    const target = localPath(base, relative);
    const replaced = existsSync(target);
    if (replaced && !force) {
      throw new Error(`Refusing to overwrite ${relative}; review local changes, then repeat with --force`);
    }
    if (replaced && !statSync(target).isDirectory()) throw new Error(`Expected a directory at ${relative}`);
    return { agent, relative, target, replaced };
  });
  const installed: SkillInstallation[] = [];
  for (const item of planned) {
    if (item.replaced) rmSync(item.target, { recursive: true, force: true });
    mkdirSync(dirname(item.target), { recursive: true });
    cpSync(source, item.target, { recursive: true, dereference: true, errorOnExist: true, force: false });
    installed.push({ agent: item.agent, path: item.relative, replaced: item.replaced });
  }
  return installed;
}
