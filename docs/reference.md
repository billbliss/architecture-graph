# Commands and files

Use this page when you know what you want to do and need the exact command. For a first installation, start with [getting started](getting-started.md).

In the commands below, `ag` means `./node_modules/.bin/ag`, run from the project where you installed the toolkit. The hello-world example also provides `npm run ag -- <command>`.

## Find the design before you change it

| Command | What it helps you answer |
| --- | --- |
| `ag context --id capability:welcome` | What responsibilities and rules surround this idea? |
| `ag context --file src/formatter.js` | What does the graph say about this file? |
| `ag context --module module:greetings` | What belongs to this logical module? |
| `ag context --guardrail boundary:presentation` | Which ideas does this rule constrain? |
| `ag context --query greeting` | Where is this topic mentioned? |
| `ag summary` | What is covered, and what is still unresolved? |

The authored graph remains authoritative. Context uses current compiled indexes when available and falls back to indexes built from the graph when they are missing, stale, or corrupt. You can use it before generating anything. By default, it includes the matching ideas and their immediate connections. Add `--depth 2` to look one connection further; supported depths are 0 through 3. An ID can name an idea or a relationship. A file query matches a file already referenced by the graph. Text search matches IDs, names, and descriptions, ignoring letter case.

By default a result includes at most 60 nodes and examines at most 120 relationships. A truncated result explicitly warns that it is incomplete. Use `--max-nodes N` (2–1000) and `--max-relationships N` (1–4000), or narrow the lookup. JSON output includes `truncated`, `warnings`, `stats`, `readSource`, and `fallbackReason`. Limits bound traversal and output; loading and validating the authored graph still reads the whole file. Free-text search scans records.

A missing result means the graph has no matching record. It does not mean the affected code has no architectural significance.

## Create and maintain the records

| Command | What it does |
| --- | --- |
| `ag init --id graph:project --title "Project architecture"` | Creates configuration and an empty graph without replacing existing files |
| `ag validate` | Finds malformed records, duplicate IDs, missing relationship endpoints, conflicting ownership, and broken file references |
| `ag generate` | Writes a briefing and summary from the current graph |
| `ag check` | Reports whether those generated files are missing or out of date, without changing them |
| `ag skill install --agent claude` | Copies the bundled skill into `.claude/skills` so Claude Code can use it |
| `ag skill install --agent codex` | Copies the bundled skill into `.agents/skills` so Codex can use it |

`skill install` accepts both agents at once as `--agent claude,codex`, writes under `--root DIR` when the project is elsewhere, and refuses to replace an existing copy unless you add `--force`. It installs instructions; it does not create or change a graph. [Using AG with a coding agent](skill-installation.md) covers the Claude Code plugin alternative.

`init` also accepts `--root DIR` to create the starter files elsewhere. The other commands accept `--config FILE`. Paths in the graph are relative to the directory containing that configuration file. The default is `ag.config.json` in the current directory; AG does not search parent folders for it.

Use `--json` when a script needs to read context or validation diagnostics. `summary`, `generate`, and `check` always print JSON. Exit codes are 0 for success, 1 for invalid input or another error, and 2 for stale generated output.

## Which files are yours?

The default configuration is:

```json
{ "configVersion": "1", "graph": "architecture/graph.yaml", "generated": "architecture/generated" }
```

`architecture/graph.yaml` is the design record you maintain. It is the source of truth for AG. The [modeling guide](../skills/architecture-graph/references/modeling.md) explains its ideas, relationships, and statuses. The full machine-readable rules are in [the graph schema](../schema/graph.schema.json).

`architecture/generated/guidance.md` is a readable briefing. `summary.json` contains counts and open questions. These are generated from your records; editing them does not change the graph. Fix the graph and generate them again instead.

You can change either configured path. Keep the generated folder separate from the graph and its references, and reserve it for generated output. AG also generates graph, neighborhood, source-reference, module-ownership, cross-module, guardrail, and source-locator indexes, plus checksum metadata. These eight files make focused retrieval practical without replacing the authored graph. All ten files are covered by `check`. See [indexes and generation in CI](indexing-and-ci.md) for performance tradeoffs and a workflow that builds these files on GitHub Actions. AG does not delete unrelated files in that folder.

References must name existing local files using paths such as `requirements.md` or `src/formatter.js`. URLs, wildcard patterns, links to files through symlinks, and paths outside the project are not supported. Planned work does not need an invented source file.

## Checking generated output in a build

If you commit the generated files, run `ag check` before regenerating to catch an out-of-date briefing. In this repository, the test workflow also compares regenerated example guidance against the committed version.

If you choose not to commit generated output, run `ag generate` during the build. A later `ag check` confirms that the new files match the graph; it cannot tell you whether a previous version was stale.

## Using AG from TypeScript or JavaScript

The package ships compiled JavaScript, TypeScript declarations, source maps, and editable TypeScript source. A script can use the same toolkit without invoking its command line:

```js
import { loadProject, getContext, validateGraph, summarize, syncArtifacts } from '@architecture-graph/toolkit';

const project = loadProject('ag.config.json');
const context = getContext(project, { id: 'capability:welcome', depth: 1 });
const errors = validateGraph(project.graph, project.root);
const summary = summarize(project);
const result = syncArtifacts(project, { check: true });
```

Start with `loadProject`: it checks the configuration, graph, and file references, and rejects references into generated output. Treat a loaded project as a snapshot and reload after editing declarations. `loadProject(path, { forceCanonical: true })` bypasses the compiled cache. `validateGraph` checks a graph object and returns a list of `{code, at, message}` errors; it does not perform the additional configuration checks. Other operations throw errors for invalid inputs. `syncArtifacts` returns a `drift` list; without `check: true`, it writes the generated files.

The package exports types including `Graph`, `GraphNode`, `Relationship`, `GraphModule`, `Project`, and `ContextBundle`, along with typed Zod schemas. It also exports `serializeGraph` and `parseDeclarations` for working with the authored format, and `initProject`, `installSkill`, `renderArtifacts`, `formatContext`, `VERSION`, `LIMIT`, and `AGError`. Tools that read JSON can access the graph schema through `@architecture-graph/toolkit/schema`.

## One file, logical modules

Optional `modules` entries in the graph contain `id`, `name`, `description`, `exports`, and `imports`. A node's optional `module` names its owner. Relationships belong to their source node's module. For a relationship across two declared modules, the source module must import the target node, and the target module must export it. Nodes can remain unassigned during adoption; this is not a coverage guarantee.

Module membership is a logical boundary inside the single authored file. Source locators use the graph file, section, and stable object ID, so inserting another node does not renumber them.
