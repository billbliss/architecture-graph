# Contract sidecars

**Status:** Proposed. Target release: 0.4.0. Graph and configuration format: **1** (additive vocabulary).

## Problem

A contract node records a shared meaning: the shape of a task, an event, a configuration file, a command's output. Today a contract can only describe that shape in prose and point to design or implementation files. A person or agent changing the contract cannot see its structure, and a viewer cannot show it.

This specification lets a contract carry two kinds of sidecar file: one JSON Schema describing its data shape, and example payloads that conform to it. AG checks that the files exist, that the schema is valid, and that every example matches the schema. AG does not read implementation source code to produce or verify them.

## Terms

A **sidecar** is a project file attached to a graph node by a `schema` or `example` reference. A **schema sidecar** is a JSON Schema document. An **example sidecar** is a JSON or YAML document holding one example payload.

## Format change

`references[].kind` gains two values. The full set becomes `design`, `implementation`, `schema` and `example`.

```yaml
- id: contract:task-changed
  kind: contract
  name: Task changed
  description: Announced after a change is saved, never before. May be delivered more than once.
  status: proposed
  references:
    - kind: design
      path: requirements.md
    - kind: schema
      path: contracts/task-changed.schema.json
    - kind: example
      path: contracts/examples/task-changed.json
```

Rules, each reported as a validation diagnostic:

| Rule | Diagnostic code |
| --- | --- |
| `schema` and `example` references are allowed only on nodes of kind `contract`, `data_object` or `artifact`. They are not allowed on relationships. | `sidecar-kind` |
| A node has at most one `schema` reference. | `sidecar-schema-count` |
| A node with an `example` reference must also have a `schema` reference. | `sidecar-example-without-schema` |
| A schema sidecar must be a `.json` file containing a valid JSON Schema (see below). | `sidecar-schema` |
| An example sidecar must be a `.json`, `.yaml` or `.yml` file holding exactly one document. | `sidecar-example-parse` |
| Every example must validate against its node's schema. | `sidecar-example` |

Sidecar references follow every existing reference rule: the path is project-local, names an existing file, and must not point into generated output. The rule that an `implemented` record needs an `implementation` reference is unchanged; a `schema` or `example` reference does not satisfy it.

The format version stays **1**. As [the compatibility policy](../compatibility.md) already states, older toolkit versions may reject added vocabulary: a graph using these kinds requires AG 0.4.0 or later. The published `schema/graph.schema.json` is regenerated from the updated definitions.

## Checking schemas and examples

AG validates sidecars with [Ajv](https://ajv.js.org/) and [ajv-formats](https://github.com/ajv-validator/ajv-formats), added as runtime dependencies. Zod continues to define and validate the authored graph format itself; Ajv is used only for sidecars, because it implements JSON Schema completely and resolves references between files.

- **Dialects.** A schema's `$schema` selects draft 2020-12 or draft-07. A schema without `$schema` is treated as draft 2020-12. Other dialects are rejected.
- **Strictness.** Schemas compile in Ajv strict mode, so misspelled or unknown keywords are errors rather than silently ignored rules.
- **Formats.** `format` values supported by ajv-formats (for example `date-time`, `date`, `email`, `uri`, `uuid`) are checked. An unknown format is an error.
- **References between files.** A `$ref` to a relative path such as `task.schema.json` resolves against the referencing file's directory. The target must be a project-local file and is loaded and checked the same way. References to fragments within a file (`#/$defs/...`) work as usual. AG never fetches a schema over the network; an unresolvable `$ref` is a `sidecar-schema` error.
- **Examples.** Each example is parsed (YAML with the same restrictions as the authored graph: one document, no aliases or custom tags) and validated against the compiled schema. The diagnostic includes the example path and the failing JSON pointer.

Sidecars are checked by `ag validate`, by `loadProject` and therefore by every command that loads a project. Sidecar checking reads each sidecar file once per load. The compiled-index cache does not skip it, consistent with loading always validating the whole graph.

## Default file locations

References are authoritative; AG does not discover sidecars by file name. New sidecars should nonetheless use one convention so that people and tools can find them:

- Schema: `contracts/<name>.schema.json`
- Examples: `contracts/examples/<name>.json`, or `contracts/examples/<name>.<variant>.json` for several examples

`<name>` is the node ID without its kind prefix (`contract:task-changed` → `task-changed`). Paths are relative to the configuration directory. A project whose build already produces a schema elsewhere should reference that file instead of copying it. AG's own `contract:authored-format`, for example, references `schema/graph.schema.json`.

## What other commands show

**Context.** Sidecar files are references, so they are indexed like any other: `ag context --file contracts/task.schema.json` returns the contract. Text output lists them with their kinds (`schema: contracts/task.schema.json`). Context does not embed sidecar contents; the reader opens the referenced files, as with design and implementation references. Embedding contents is deferred because it would need its own size limits.

**Summary.** `summary.json` and `ag summary` gain a `sidecars` section:

```json
"sidecars": {
  "eligible": 8,
  "withSchema": 5,
  "withExamples": 4,
  "withoutSchema": ["contract:logical-modules", "contract:public-operations", "data_object:audit-entry"]
}
```

`eligible` counts nodes of kinds that may carry sidecars. `withoutSchema` lists every eligible node without a schema, sorted by ID. A missing schema is not a validation error: behavioral contracts, such as exit-code rules, may legitimately have none. The list exists to drive backfill.

**Guidance.** `guidance.md` gains one sentence reporting how many eligible nodes have schemas, pointing to `ag summary` for the list.

**Generated views refer, never copy.** Any generated view, including `guidance.md`, compiled indexes and derived documents such as per-area guardrail briefings, may list a node's sidecar paths but must not copy schema or example contents. The sidecar files stay the only copy of a contract's shape, so regenerating a view cannot leave a stale second version behind.

**Upgrade impact.** Because `summary.json` and `guidance.md` change shape, every project's generated output is stale after upgrading to 0.4.0. Run `ag generate` once and commit the result; `ag check` reports the drift until then.

## What this does not establish

A valid schema and passing examples show that the sidecar files agree with each other. They do not show that the implementation produces or accepts data of that shape. A schema generated from code at one point in time can drift from the code afterwards without AG noticing. Projects that want that assurance should add their own test that runs the real code and validates its output against the sidecar. AG's own tests will do this for `contract:bounded-context` as part of this change.

## Changes to make

1. `src/schema.ts`: extend the reference kind enum.
2. New `src/sidecars.ts`: load, compile and check sidecars; return diagnostics.
3. `src/validation.ts`: call sidecar checks after reference-existence checks, with the rules above.
4. `src/artifacts.ts`: add the `sidecars` summary section and the guidance sentence.
5. `package.json`: add `ajv` and `ajv-formats` as pinned runtime dependencies.
6. Tests: each diagnostic code; draft-07 and 2020-12; a cross-file `$ref`; YAML examples; a schema outside `contracts/`; a project with no sidecars (no change in diagnostics); summary counts.
7. Documentation: [commands and files](../reference.md), [the compatibility page](../compatibility.md), and [the modeling guide](../../skills/architecture-graph/references/modeling.md).
8. AG's own graph: backfill sidecars for its data-shaped contracts and mark this decision implemented with implementation references.
9. The [task-manager example](../../examples/task-manager/README.md): change its contract references from `design` to `schema` and `example`.

## Open questions

- Should a project be able to require schemas for all eligible nodes, turning the `withoutSchema` list into validation errors? This specification makes them advisory only.
- Should context embed sidecar contents when explicitly requested, for example with `--include-sidecars` and a byte limit?
