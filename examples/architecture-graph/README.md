# AG models itself

Hello-world shows the mechanics in a tiny application. This example shows why AG is useful in a real project: before changing a loader, query limit or installer, an agent can find who owns that behavior and which contracts the change must preserve. It records the current toolkit's responsibilities, software ownership, shared contracts, boundaries, decisions, and open questions.

It is also the architecture record used when developing AG. Start with [generated guidance](architecture/generated/guidance.md), then retrieve focused context from the [canonical graph](architecture/graph.yaml).

The four logical modules are declarations, context, interfaces, and delivery. They group design responsibilities, not separate packages or enforced TypeScript dependency layers. Their imports and exports describe the cross-module relationships in this model; they are not a complete inventory of source imports. `owns` identifies a component responsible for a capability; `authority_for` identifies where a shared meaning is defined. No human maintainer assignment is inferred from repository authorship.

The model was read from the current docs and implementation, including local edits. Implementation references support authored claims; they are not proof of conformance. Historical predecessor material is background, not a specification for this toolkit. Marketplace readiness, Windows support, and human ownership remain explicit questions.

## Start with a real change

Ask your coding agent to use the architecture-graph skill to inspect this model before editing AG. For example:

> We want to change how context limits work. Use the self-model to identify the responsible component, public contract and affected callers. Read their implementation references, explain the consequences, and maintain the graph if the design changes.

These are useful starting queries after building the checkout:

| Question | Command | What to look for |
| --- | --- | --- |
| What must a query-limit change preserve? | `node bin/ag.js context --id contract:bounded-context` | The context engine’s authority and its relationship to the bounded-context contract |
| What depends on loading a project? | `node bin/ag.js context --file src/project.ts --depth 2` | Canonical validation, index fallback and callers consuming a project snapshot |
| What belongs to delivery? | `node bin/ag.js context --module module:delivery` | Packaging, skill installation and distribution decisions |
| Where could we overstate what checks prove? | `node bin/ag.js context --guardrail boundary:declarations-not-proof` | Validation, generated output and agent instructions constrained by that boundary |

Read the referenced code and documents before deciding on a change. The graph directs that investigation; it does not replace it. Its four modules are connected and can have mutual dependencies, so they should not be read as a strict dependency hierarchy.

## Run from the repository root

```sh
npm ci
npm run build
node bin/ag.js validate
node bin/ag.js generate
node bin/ag.js check
node bin/ag.js context --file src/project.ts --depth 2
node bin/ag.js context --id contract:bounded-context
node bin/ag.js context --module module:delivery
node bin/ag.js context --guardrail boundary:declarations-not-proof
node bin/ag.js summary
```

Use the checkout's launcher after building: a separately installed AG package can have the same version while containing older implementation. From this example directory, for example, run `node ../../bin/ag.js context --config ../../ag.config.json --file src/context.ts`. File queries still use repository-relative paths. Inspect truncation and warnings. `check` before `generate` detects stale committed output; after generation it confirms that the new output matches. Toolkit behavior is tested separately with `npm test`.

## Reuse the layout

The [configuration](../../ag.config.json) lives at the repository root because AG resolves every path from the configuration directory and forbids `..`, absolute paths and symlink references. It selects this example's YAML and generated directory. References such as `src/schema.ts` point to the actual toolkit: there is no example copy of the implementation, no second canonical graph, and no nested configuration that escapes its project root.

Use this example from a full repository checkout; its references include development tests, scripts, and CI files that are not all shipped in the npm package. To apply the pattern elsewhere, place configuration at the common root of the real sources and model, adjust its graph/output paths, and rewrite the declarations for that project's design. Do not copy this folder alone and expect its toolkit references to remain valid.

Maintain the YAML and its references following [AGENTS.md](../../AGENTS.md). Commit all ten generated views alongside graph changes. The root maintenance instructions apply here.
