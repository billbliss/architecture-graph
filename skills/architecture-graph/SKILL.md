---
name: architecture-graph
description: Bootstrap architectural declarations from requirements and design documents, or maintain an existing Architecture Graph during changes to responsibilities, ownership, authorities, contracts, and boundaries.
metadata:
  version: "0.1.0"
---

# Architecture Graph

Use the consuming repository's installed `@architecture-graph/toolkit` 0.1.0 (graph/config schema `1`). Run `./node_modules/.bin/ag --version` from the consumer root. If missing, follow the project's installation instructions; do not silently fetch an unrelated registry package. In the steps below, `ag` means `./node_modules/.bin/ag` unless the project provides an equivalent npm script. No Visual Studio dependency.

Read project instructions and `ag.config.json`. Paths resolve from the config directory; use `--config` explicitly from other directories. Canonical declarations are project-owned. Generated guidance is a projection, never a source of truth.

## Bootstrap

Read the actual requirements and design documents before declaring architecture. Extract durable responsibilities, structural elements, owners, semantic authorities, contracts, and boundaries. Use [the modeling reference](references/modeling.md) for schema and relation choices. Start proportionately; a document or source file does not automatically deserve a node.

Identify contradictions and open questions. Record disputed alternatives as unresolved nodes/relationships with descriptions and real document references. Distinguish explicit design statements from inferred proposals. Do not resolve product decisions just to get a valid graph. Ask only about decisions that block the user's requested work; preserve other uncertainty in the graph.

Run `ag init --id graph:<project> --title "<project> architecture"` if no graph exists, then author its scope and declarations. Proposed nodes need no source code; reference existing design documents. Never create fictitious files or evidence. Add a short instruction to the project's existing AGENTS.md explaining when to retrieve and maintain AG; preserve unrelated instructions.

Run `ag validate`, `ag generate`, and `ag check`. Review whether the graph reflects the documents and whether unresolved choices remain visible. An empty or structurally valid graph is not proof of adequate modeling.

## Maintain

Before changing architecture, run `ag context --file <repo-relative-path>` or `ag context --id <node-id>`. Use `--query <text>` for discovery and `--depth 2` for wider context when needed. A missing match is a coverage gap to investigate. Read the retrieved declarations and referenced files, including incoming ownership, authority, contracts, and decisions.

Update declarations alongside the implementation. Preserve identities through renames and moves. Mark elements implemented only after real implementation exists; supply implementation references for implemented nodes and relationships. Keep design references. Revise affected contracts and unresolved decisions honestly.

Run application checks appropriate to the change, then `ag validate`, `ag generate`, and `ag check`. Review both declaration and guidance diffs. Fix drift at the canonical source and regenerate. Report structural results separately from behavioral results: AG neither executes AAG proofs nor establishes implementation conformance.
