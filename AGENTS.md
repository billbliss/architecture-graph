# Maintain AG's own architecture

Before design changes, consult the self-model in `examples/architecture-graph/architecture/graph.yaml` and its referenced docs and source. The root `ag.config.json` selects this one canonical graph; all references are repository-relative. See `examples/architecture-graph/README.md` for scope and reuse.

Build the checkout with `npm run build`, then use `node bin/ag.js context --file src/<file>.ts` (or `--id`, `--module`, `--guardrail`, `--query`, and `--depth 2`). Inspect `truncated` and warnings before relying on a result. From another directory, pass `--config <path-to-repository>/ag.config.json`. Use the checkout CLI for toolkit development so it runs the source you just built, rather than an older installed copy.

Maintain the graph alongside changes to responsibilities, ownership, shared contracts, module boundaries, public interfaces, packaging, or agent workflows. Keep IDs stable; retain design references and add actual implementation references when marking records implemented. Ownership here describes software responsibilities, not assigned people. Keep unresolved questions explicit until there is a documented resolution; do not infer marketplace readiness, platform support, or code conformance from passing graph checks.

Edit TypeScript in `src/` and the bundled skill in `skills/architecture-graph/`. `lib/`, exported JSON schemas, and graph guidance/indexes are generated views. Do not copy toolkit source into the self-model example or edit generated views by hand.

After changes, run appropriate behavior tests (`npm test` for toolkit changes; also `npm run test:consumer` for packaging/public API changes). Run `node bin/ag.js validate`, `node bin/ag.js generate`, and `node bin/ag.js check`, and review the graph and briefing together. For committed-output drift checks, run `check` before regeneration. Report declaration validation separately from behavioral tests: AG does not prove conformance.

Write Markdown prose with one paragraph per source line and use editor soft wrapping. Preserve structural line breaks in lists, tables, headings, code blocks, frontmatter and intentional Markdown hard breaks; do not manually wrap prose to a fixed column width.
