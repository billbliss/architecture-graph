// What the site publishes: the bundled examples and the docs navigation.
import { readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { repoFile } from './repo';

export interface ExampleInfo {
  name: string;
  title: string;
  summary: string;
  /** Repository-relative path of the example's configuration. */
  config: string;
}

export const EXAMPLES: ExampleInfo[] = [
  {
    name: 'task-manager',
    title: 'Task manager',
    summary: 'A familiar design at the design stage: tasks, reminders, offline sync, notifications and search, with contract schemas, examples and open questions.',
    config: 'examples/task-manager/ag.config.json',
  },
  {
    name: 'architecture-graph',
    title: 'AG models itself',
    summary: "The toolkit's own responsibilities, contracts, boundaries and decisions: the graph used when developing AG.",
    config: 'ag.config.json',
  },
  {
    name: 'hello-world',
    title: 'Hello-world',
    summary: 'A tiny runnable application that shows a design decision recorded, retrieved before a change, and kept current afterward.',
    config: 'examples/hello-world/ag.config.json',
  },
];

export const EXAMPLE_NAMES = EXAMPLES.map(example => example.name);

/** Main docs navigation, in reading order. Pages not listed here are published but not in the menu. */
export const DOCS_NAV: { title: string; items: string[] }[] = [
  { title: 'Start', items: ['docs/README.md', 'docs/getting-started.md', 'docs/skill-installation.md', 'docs/languages-and-toolchain.md'] },
  { title: 'Use', items: ['docs/reference.md', 'docs/manual-operation.md', 'docs/indexing-and-ci.md', 'docs/compatibility.md'] },
  { title: 'Develop and release', items: ['docs/development.md', 'docs/foundation.md', 'docs/publishing.md', 'docs/github-packaging.md'] },
];

/** Every Markdown file under docs/, repository-relative. */
export function docsFiles(): string[] {
  const walk = (dir: string): string[] => readdirSync(repoFile(dir), { withFileTypes: true }).flatMap(entry => {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
  return walk('docs').sort();
}
