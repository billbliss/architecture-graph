# Manual operation and inspection

AG’s intended workflow relies on a coding agent to keep declarations current as code changes, with people directing and reviewing decisions. These commands explain the underlying operations for inspection, troubleshooting and automation. They are also usable by hand, but continuous manual graph maintenance is not the recommended adoption path.

Create the starter files:

```sh
./node_modules/.bin/ag init --id graph:my-project --title "My project architecture"
```

This creates `ag.config.json` and an **empty** `architecture/graph.yaml`. It does not scan code or decide what your architecture should be. If these files already exist, it refuses to replace them.

Read your requirements, then edit the graph's description to explain its scope. Add a few important ideas to the `nodes` array. For example:

```yaml
- id: capability:welcome
  kind: capability
  name: Welcome a person
  description: "Proposed responsibility: welcome a person by name. The wording is still undecided."
  status: proposed
  references: []
```

Replace the starter’s `nodes: []` with `nodes:` followed by this list entry, indented two spaces. Keep the other top-level fields. This adds one idea; it does not replace the whole graph. The [modeling guide](../skills/architecture-graph/references/modeling.md) explains how to connect ideas and cite existing documents. A project with no code can have a useful graph: leave planned work proposed and unanswered choices unresolved.

Run `ag validate`, `ag generate` and `ag check` after edits, using the project’s installed executable. The [command reference](reference.md) covers context queries and automation. Application tests still check behavior; AG checks the records.
