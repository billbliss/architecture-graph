---
name: architecture-graph
description: Create a useful architecture graph from requirements and design documents, or keep an existing graph current as responsibilities, ownership, shared rules, and boundaries change.
metadata:
  version: "0.1.0"
---

# Help a project remember its design

Use AG to make important design decisions easier to find before a change. The result should help someone understand what a part of the system is responsible for, which rules it must preserve, and what is still undecided. A graph that merely passes validation is not enough.

Use the project's installed `@architecture-graph/toolkit` **0.1.0**, with graph/config format **1**. Check `./node_modules/.bin/ag --version` from the project root. If it is missing, follow the project's installation instructions; do not fetch an unrelated registry package. Below, `ag` means that local executable or the project's equivalent npm script. Visual Studio is not required.

Read project instructions and `ag.config.json`. Paths are relative to the configuration directory; use `--config` when working elsewhere. The project owns its graph. Generated guidance is a view of that graph, not a place to make design changes.

## Bootstrap: build the first useful record

Read the actual requirements and design documents. Identify the responsibilities, owners, sources of shared meaning, rules, and boundaries worth remembering. Start small; not every document or file needs its own graph entry. Consult [the modeling guide](references/modeling.md) for how to express these ideas.

Distinguish agreed requirements from inferred proposals. Record contradictions, unchosen alternatives, and unanswered questions as unresolved, citing real documents where available. Do not make a product decision just to satisfy validation. Ask about decisions that block the requested work; preserve the other questions in the graph.

If no graph exists, run `ag init --id graph:<project> --title "<project> architecture"`. This creates empty files, not an inferred design. Fill in the scope and initial records from what you read. Planned work does not need invented implementation files or evidence.

Add a short reminder to the project's AGENTS.md to consult AG before design changes and maintain it alongside the code. Preserve other project instructions. Run `ag validate`, `ag generate`, and `ag check`, then review whether the result explains the design and keeps uncertainty visible.

## Maintain: start a change with the design in view

Use `ag context --file <project-relative-path>` or `ag context --id <id>` before changing architecture. Use `--query <text>` to find a topic and `--depth 2` for wider context. If nothing matches, investigate whether the graph is missing useful coverage.

Read the returned records and referenced files, including owners, authorities, rules, and open decisions. Update the graph when the design changes. Keep IDs stable through file moves. Mark records implemented only when real implementation exists, adding implementation references to implemented ideas and relationships while retaining design references.

Run appropriate application tests, then `ag validate`, `ag generate`, and `ag check`. Review the graph and generated briefing together. Fix stale guidance by updating the graph and regenerating. Report checks of the records separately from tests of behavior: AG does not run AAG proofs or establish that code follows the design.
