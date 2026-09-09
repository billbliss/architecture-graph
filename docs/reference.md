# Commands and files

Use this page when you know what you want to do and need the exact command. For a first installation, start with [getting started](getting-started.md).

In the commands below, `ag` means `./node_modules/.bin/ag`, run from the project where you installed the toolkit. The hello-world example also provides `npm run ag -- <command>`.

## Find the design before you change it

| Command | What it helps you answer |
| --- | --- |
| `ag context --id capability:welcome` | What responsibilities and rules surround this idea? |
| `ag context --file src/formatter.js` | What does the graph say about this file? |
| `ag context --query greeting` | Where is this topic mentioned? |
| `ag summary` | What is covered, and what is still unresolved? |

Context comes directly from the graph, so you can use it before generating a briefing. By default, it includes the matching ideas and their immediate connections. Add `--depth 2` to look one connection further; supported depths are 0 through 3. An ID can name an idea or a relationship. A file query matches a file already referenced by the graph. Text search matches IDs, names, and descriptions, ignoring letter case.

A missing result means the graph has no matching record. It does not mean the affected code has no architectural significance.

## Create and maintain the records

| Command | What it does |
| --- | --- |
| `ag init --id graph:project --title "Project architecture"` | Creates configuration and an empty graph without replacing existing files |
| `ag validate` | Finds malformed records, duplicate IDs, missing relationship endpoints, conflicting ownership, and broken file references |
| `ag generate` | Writes a briefing and summary from the current graph |
| `ag check` | Reports whether those generated files are missing or out of date, without changing them |

`init` also accepts `--root DIR` to create the starter files elsewhere. The other commands accept `--config FILE`. Paths in the graph are relative to the directory containing that configuration file. The default is `ag.config.json` in the current directory; AG does not search parent folders for it.

Use `--json` when a script needs to read context or validation diagnostics. `summary`, `generate`, and `check` always print JSON. Exit codes are 0 for success, 1 for invalid input or another error, and 2 for stale generated output.

## Which files are yours?

The default configuration is:

```json
{ "configVersion": "1", "graph": "architecture/graph.json", "generated": "architecture/generated" }
```

`architecture/graph.json` is the design record you maintain. It is the source of truth for AG. The [modeling guide](../skills/architecture-graph/references/modeling.md) explains its ideas, relationships, and statuses. The full machine-readable rules are in [the graph schema](../schema/graph.schema.json).

`architecture/generated/guidance.md` is a readable briefing. `summary.json` contains counts and open questions. These are generated from your records; editing them does not change the graph. Fix the graph and generate them again instead.

You can change either configured path. Keep the generated folder separate from the graph and its references, and reserve it for generated output. AG writes only the two files above; it does not delete other files in that folder.

References must name existing local files using paths such as `requirements.md` or `src/formatter.js`. URLs, wildcard patterns, links to files through symlinks, and paths outside the project are not supported. Planned work does not need an invented source file.

## Checking generated output in a build

If you commit the generated files, run `ag check` before regenerating to catch an out-of-date briefing. In this repository, the test workflow also compares regenerated example guidance against the committed version.

If you choose not to commit generated output, run `ag generate` during the build. A later `ag check` confirms that the new files match the graph; it cannot tell you whether a previous version was stale.

## Using AG from JavaScript

A script can use the same toolkit without invoking its command line:

```js
import { loadProject, getContext, validateGraph, summarize, syncArtifacts } from '@architecture-graph/toolkit';

const project = loadProject('ag.config.json');
const context = getContext(project, { id: 'capability:welcome', depth: 1 });
const errors = validateGraph(project.graph, project.root);
const summary = summarize(project);
const result = syncArtifacts(project, { check: true });
```

Start with `loadProject`: it checks the configuration, graph, and file references, and rejects references into generated output. Reload after editing files. `validateGraph` checks a graph object and returns a list of `{code, at, message}` errors; it does not perform the additional configuration checks. Other operations throw errors for invalid inputs. `syncArtifacts` returns a `drift` list; without `check: true`, it writes the generated files.

The package also exports `initProject`, `renderArtifacts`, `formatContext`, `VERSION`, `LIMIT`, and `AGError`. Tools that read JSON can access the graph schema through `@architecture-graph/toolkit/schema`.
