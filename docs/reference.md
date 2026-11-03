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

## Contract schemas and examples

A `contract`, `data_object` or `artifact` node can carry sidecar files that describe its data shape: one `schema` reference to a JSON Schema and any number of `example` references to example payloads.

```yaml
references:
  - kind: design
    path: requirements.md
  - kind: schema
    path: contracts/task-changed.schema.json
  - kind: example
    path: contracts/examples/task-changed.json
```

`ag validate`, and every command that loads a project, checks that:

| Diagnostic | Check |
| --- | --- |
| `sidecar-kind` | Sidecar references appear only on contract, data_object and artifact nodes, never on relationships |
| `sidecar-schema-count` | A node has at most one schema |
| `sidecar-example-without-schema` | A node with examples also has a schema |
| `sidecar-schema` | The schema is a `.json` file holding valid JSON Schema (draft 2020-12, or draft-07 when `$schema` says so), with no unknown keywords or formats, and every `$ref` resolves |
| `sidecar-example-parse` | Each example is a `.json`, `.yaml` or `.yml` file with one document |
| `sidecar-example` | Each example matches the schema, including `format` values such as `date-time` |

A `$ref` to a relative path, such as `task.schema.json` or `../../schema/graph.schema.json#/properties/nodes/items`, resolves against the referencing file and must stay inside the project. AG never fetches schemas over the network.

New sidecars conventionally live at `contracts/<name>.schema.json` and `contracts/examples/<name>.json`, where `<name>` is the node ID without its prefix. The reference is what counts: if the build already produces a schema elsewhere, reference that file instead of copying it. Sidecars are ordinary references for lookup, so `ag context --file contracts/task.schema.json` finds the contract.

`ag summary` reports `sidecars.eligible`, `withSchema`, `withExamples` and `withoutSchema`, the list of eligible nodes with no schema yet. A missing schema is not an error; contracts that are rules rather than data shapes need none. The [modeling guide](../skills/architecture-graph/references/modeling.md) explains when to add sidecars.

Passing these checks shows that the schema and examples agree with each other, not that the code produces or accepts that data. To check the code, add a test that runs it and validates the output with `sidecarValidator` (see below).

## Checking generated output in a build

If you commit the generated files, run `ag check` before regenerating to catch an out-of-date briefing. In this repository, the test workflow also compares regenerated example guidance against the committed version.

If you choose not to commit generated output, run `ag generate` during the build. A later `ag check` confirms that the new files match the graph; it cannot tell you whether a previous version was stale.

## Using AG from TypeScript or JavaScript

The package ships compiled JavaScript, TypeScript declarations, source maps, and editable TypeScript source. A script can use the same toolkit without invoking its command line:

```js
import { loadProject, getContext, validateGraph, summarize, syncArtifacts } from '@billbliss/architecture-graph';

const project = loadProject('ag.config.json');
const context = getContext(project, { id: 'capability:welcome', depth: 1 });
const errors = validateGraph(project.graph, project.root);
const summary = summarize(project);
const result = syncArtifacts(project, { check: true });
```

To check that real output still matches a contract's schema sidecar, compile it with the same rules and `$ref` resolution as validation:

```js
import { sidecarValidator } from '@billbliss/architecture-graph';

const check = sidecarValidator(project.root, 'contracts/task-changed.schema.json');
const { valid, errors } = check(actualOutput);
```

`sidecarValidator` throws when the schema itself is invalid.

Start with `loadProject`: it checks the configuration, graph, and file references, and rejects references into generated output. Treat a loaded project as a snapshot and reload after editing declarations. `loadProject(path, { forceCanonical: true })` bypasses the compiled cache. `validateGraph` checks a graph object and returns a list of `{code, at, message}` errors; it does not perform the additional configuration checks. Other operations throw errors for invalid inputs. `syncArtifacts` returns a `drift` list; without `check: true`, it writes the generated files.

The package exports types including `Graph`, `GraphNode`, `Relationship`, `GraphModule`, `Project`, and `ContextBundle`, along with typed Zod schemas. It also exports `serializeGraph` and `parseDeclarations` for working with the authored format, `sidecarValidator` and `SIDECAR_KINDS` for contract sidecars, `nodeFileSource` and the `FileSource` types described below, and `initProject`, `installSkill`, `renderArtifacts`, `formatContext`, `VERSION`, `LIMIT`, and `AGError`. Tools that read JSON can access the graph schema through `@billbliss/architecture-graph/schema`.

### Validating without Node: the browser-safe core

`@billbliss/architecture-graph/core` runs the same validation as `ag validate` and `validateGraph`, including sidecar checks, in any JavaScript environment. It imports nothing from Node, directly or through its dependencies (Zod, yaml, Ajv and ajv-formats), and reads project files only through a file source that you supply:

```js
import { validateGraph, validateGraphSync, memoryFileSource, parseDeclarations } from '@billbliss/architecture-graph/core';

const files = { 'architecture/graph.yaml': graphText, 'requirements.md': requirementsText };
const graph = parseDeclarations(files['architecture/graph.yaml'], 'architecture/graph.yaml');
const errors = await validateGraph(graph, memoryFileSource(files));
```

A file source answers two questions about a normalized project-relative path: `kind(path)` returns `'file'`, `'other'` (for example a directory) or `'missing'`, and `read(path)` returns the file's UTF-8 text. AG applies the path rules (no absolute paths, `..`, empty segments, backslashes or colons) before asking. A source throws to report that a file cannot be accessed, and its message becomes the diagnostic text.

In the core, `validateGraph(graph, source)` and `sidecarValidator(source, schemaPath)` are asynchronous and accept sources whose methods return values or promises, as browser folder access and `fetch` do. `validateGraphSync` and `sidecarValidatorSync` take a synchronous source. All four run one set of rules, so the results are the same; the tests check this against the Node path for the bundled examples and for broken graphs and sidecars. `memoryFileSource(files)` serves a map of paths to text, with directories implied by file paths.

The main package entry point is unchanged for Node callers: `validateGraph(graph, root)` and `sidecarValidator(root, schemaPath)` stay synchronous and use `nodeFileSource(root)`, which also rejects paths that pass through symlinks. The core cannot see symlinks, so a source for another environment decides what links mean for it. The core does not load configuration files, generate output, or provide context; those remain Node operations.

Two cautions for browser use. Ajv compiles schemas into functions at run time, so a page with a Content Security Policy that forbids `unsafe-eval` cannot check sidecars. Parse error messages for malformed JSON come from the JavaScript engine, so their wording can differ between browsers and Node; the diagnostic code and location do not.

## One file, logical modules

Optional `modules` entries in the graph contain `id`, `name`, `description`, `exports`, and `imports`. A node's optional `module` names its owner. Relationships belong to their source node's module. For a relationship across two declared modules, the source module must import the target node, and the target module must export it. Nodes can remain unassigned during adoption; this is not a coverage guarantee.

Module membership is a logical boundary inside the single authored file. Source locators use the graph file, section, and stable object ID, so inserting another node does not renumber them.
