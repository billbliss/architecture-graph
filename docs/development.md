# Change the toolkit with confidence

AG's implementation is editable TypeScript in `src/`. The JavaScript under `lib/` is generated for npm users; change the source rather than editing that output. This separates a convenient installation from a maintainable development codebase.

These instructions are for changing AG itself. To use AG with an application written in any language, install the packaged toolkit; you do not need its TypeScript compiler. See [language support and toolchain impact](languages-and-toolchain.md).

Consult [AG's self-model](https://github.com/billbliss/architecture-graph/tree/main/examples/architecture-graph) before design changes and follow the root [maintenance instructions](https://github.com/billbliss/architecture-graph/blob/main/AGENTS.md). The root configuration selects the example graph while references point directly to this checkout's source. CI validates it and checks committed generated output before regeneration.

From a clone of the repository:

```sh
npm ci
npm run build
npm test
npm run test:consumer
```

`build` runs strict TypeScript checking, writes JavaScript, type declarations and source maps, and refreshes the JSON schemas from the same Zod definitions used at runtime. `test:consumer` installs a packed toolkit in a separate directory and checks both JavaScript use and TypeScript declarations. Runtime dependencies may be downloaded by npm; the package itself comes from the local archive.

The useful entry points are:

| Source | Responsibility |
| --- | --- |
| `src/schema.ts` | Shared graph types and runtime schema |
| `src/validation.ts` | Relationship, ownership, module and reference rules |
| `src/project.ts` | Load one authored file with explicit project configuration |
| `src/indexes.ts` | Build stable lookup tables from validated declarations |
| `src/compiled.ts` | Read and write disposable indexes with freshness checks |
| `src/context.ts` | Retrieve bounded neighborhoods and report omissions |
| `src/artifacts.ts` | Generate a short briefing, summary and indexes |
| `src/skills.ts` | Install the bundled agent skill into a project |
| `src/cli.ts` | Public command-line interface |

`bin/ag.js` is only a small runtime launcher. Both source and generated type/source maps are included in the package. Consumers need Node, not a TypeScript compiler; contributors install the compiler through the project's development dependencies.

The foundation tests include 5,000 nodes, high-fanout queries, logical module boundaries, YAML/JSON parity and stale/corrupt indexes. They check bounded work and observable behavior rather than using fragile wall-clock performance thresholds. A load still reads the full authored graph; reuse a loaded project for several library queries, and reload it after edits.

Run `npm run package` and `npm run test:package` to test the exact distributable archive. Preserve the separation between authored design, derived indexes and assurance evidence when extending the toolkit. See [indexes and generation in CI](indexing-and-ci.md) for the cost of loading, querying and generation.

Write Markdown prose with one paragraph per source line and use editor soft wrapping. Preserve structural line breaks in lists, tables, headings, code blocks, frontmatter and intentional Markdown hard breaks; do not manually wrap prose to a fixed column width.
