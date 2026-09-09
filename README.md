# Architecture Graph

Architecture Graph (AG) preserves architectural intent: responsibilities, ownership, authorities, contracts, boundaries, and relationships. Canonical declarations live with the consuming project. The toolkit retrieves context and generates guidance from those declarations.

**Structural validation is not implementation conformance.** AG checks declarations and local file presence. It cannot establish completeness, runtime behavior, exclusive authority, or absence of hidden paths. AAG is outside this release.

This MIT-licensed, locally installable package is version **0.1.0**, using graph/config schema **1**. Requires Node **22+** and npm; no runtime dependencies, build step, Alpha Engine checkout, or Visual Studio. Distribution uses local or GitHub Actions tarballs; npm registry publishing remains disabled.

## Quickstart from a clean consumer

Create a distributable tarball in this toolkit checkout:

```sh
npm pack --pack-destination /tmp
```

Then in any new or existing consumer directory:

```sh
npm init -y # only if package.json does not exist
npm install --save-dev /tmp/architecture-graph-toolkit-0.1.0.tgz
./node_modules/.bin/ag init --id graph:my-project --title "My project architecture"
```

`init` creates `ag.config.json` and an empty `architecture/graph.json`. It refuses to overwrite either. Read requirements and edit the graph before treating it as useful context. For example, add a proposed capability to `nodes`:

```json
{
  "id": "capability:greet",
  "kind": "capability",
  "name": "Greeting",
  "description": "Proposed capability to greet a person; formatting remains undecided.",
  "status": "proposed",
  "references": []
}
```

Set the graph's description to its actual scope and exclusions. Existing documents can be referenced as `{"kind":"design","path":"requirements.md"}`. No implementation is required for proposed or unresolved elements. See [modeling guidance](skills/architecture-graph/references/modeling.md).

```sh
./node_modules/.bin/ag validate
./node_modules/.bin/ag context --id capability:greet
./node_modules/.bin/ag generate
./node_modules/.bin/ag check
```

Commit canonical declarations, configuration and the short project AG instruction. Generated files can be committed for review or recreated in CI. If omitted from version control, run `generate` before `check`; this verifies reproducibility of the current projection, not whether a previously committed projection was stale.

## Interface

| Command | Purpose |
| --- | --- |
| `ag init --root DIR --id graph:project --title TITLE` | Initialize a repository; no architectural commitments are invented |
| `ag validate` | Strict schema, unique identifiers, endpoints, typed relations, ownership cycles/conflicts, references |
| `ag context --id ID` | Node or relationship neighborhood, including incoming declarations |
| `ag context --file src/file.js` | Context for a referenced repository-relative file |
| `ag context --query greeting --depth 2` | Case-insensitive declaration search with up to three hops |
| `ag summary` | Counts, scope and unresolved declarations in JSON |
| `ag generate` | Write deterministic `guidance.md` and `summary.json` |
| `ag check` | Read-only comparison of those two generated files |

All commands except init accept `--config FILE`; its directory is the project root. Default is `./ag.config.json`, with no parent-directory discovery. `context` defaults to one hop; depth 0 includes selected nodes or a selected relationship's endpoints. Use `--json` for machine-readable context or validation diagnostics. Exit status: **0** success, **1** invalid input/declarations or operational error, **2** generated drift. `summary`, `generate`, and `check` always emit JSON.

Configuration is explicit and portable:

```json
{ "configVersion": "1", "graph": "architecture/graph.json", "generated": "architecture/generated" }
```

Change both paths as needed. Reserve the generated directory for the toolkit; it writes only its two owned files and does not prune unrelated files. Canonical declarations may not reference that directory. Paths are local normalized file paths without symlinks, traversal, globs or URLs. JSON only in this release. The JSON schemas are included in `schema/`; semantic and filesystem checks additionally run in the toolkit.

Public ESM interface:

```js
import { loadProject, getContext, validateGraph, summarize, syncArtifacts } from '@architecture-graph/toolkit';
const project = loadProject('ag.config.json'); // throws on invalid declarations
const context = getContext(project, { id: 'capability:greet', depth: 1 });
const errors = validateGraph(project.graph, project.root);
const result = syncArtifacts(project, { check: true }); // drift list; does not write
```

Also exported: `initProject`, `renderArtifacts`, `formatContext`, `VERSION`, `LIMIT`, `AGError`. `validateGraph(graph, root)` returns `{code, at, message}[]`; other APIs throw for invalid inputs. Use a freshly loaded project after edits. The graph schema is exported at `@architecture-graph/toolkit/schema` for tooling that reads JSON.

## Skill, example and adoption

- [Install and use the Codex skill](docs/skill-installation.md)
- [Hello-world lifecycle walkthrough](docs/hello-world.md)
- [Filmcraft adoption](docs/filmcraft-adoption.md)
- [Versioning, limits and future AAG integration](docs/compatibility.md)
- [Extraction assessment and branch selection](docs/extraction-assessment.md)
- [Validation results](docs/validation-results.md)
- [GitHub Actions packages and release process](docs/github-packaging.md)

Licensed under the [MIT License](LICENSE).

For toolkit development, run `npm run verify`. It executes structural/error tests and an offline tarball installation in a temporary consumer, then installs the same tarball into the checked-in example and runs it through the public CLI. The example's `node_modules` is ignored and can be removed. No package registry or Alpha Engine checkout is needed.
