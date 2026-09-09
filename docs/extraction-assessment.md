# Extraction assessment

Inspected Alpha Engine read-only at revision `7fcbe6b64ec6cd5bd436107a15d29818949ed4d6` on 2026-09-09. No source was modified or migrated. File hashes and per-file dirty status are in `extraction-source.json`. The inspected roadmap had an uncommitted AG-Y status update; its exact diff is retained in `source-roadmap.patch`. This informed the exclusion of assurance machinery, not toolkit behavior. Other active AAG changes were visible in git status but were not extracted.

| Existing concept / implementation | Standalone disposition |
| --- | --- |
| Doctrine: durable identity, components versus capabilities, ownership, authority, contracts, boundaries | Preserve as a small ontology and explicit relationship declarations |
| Strict schema and endpoint/reference validation | Reimplement with portable JSON schema and semantic checks; no domain classification vocabulary |
| Canonical YAML separate from generated read models | Preserve authority distinction; v1 uses JSON only to avoid a parser dependency |
| Source-path and one-hop neighborhood lookup | Preserve in canonical-data queries, with explicit depth and no generated-cache dependency |
| Deterministic compilation and agent projections | Preserve as two small generated files with exact drift checks |
| Hard-coded graph registry, directory inference, module manifests, ownership headers | Replace with one explicit config relative to its repository root |
| Report UI, explorer, fixed timestamps, Alpha-specific scripts and fixtures | Exclude |
| Closed-world claims, proof catalogs, execution, admission, evidence freshness and scheduling | Exclude; existence and structure never imply conformance |

Smallest boundary: one dependency-free Node 22 ESM package exposing a CLI and library, one JSON graph per configured project, a bundled compatible skill, and a separately installed example. No source implementation is copied verbatim; conceptual continuity is intentional, serialized Alpha Engine compatibility is not claimed. Stable IDs survive code moves. Proposed nodes and unresolved decisions can exist without source references. Implemented nodes require actual local implementation files; this is a presence check only.

Tradeoffs: JSON has less authoring convenience than YAML but works without downloads; a single graph is adequate for the first consumer; finite typed relations avoid an arbitrary query engine. Human review remains necessary for meaning, contradictions, completeness, and truthful lifecycle declarations.

## Branch selection

The user identified several possible baselines. Compared working file hashes in the four named development worktrees (full records in `worktree-comparison.json`):

- AG-V: `899f40bac8cd4e8be2d0bb2be74a1e5b15b59a16`
- AG-Y (main checkout): `7fcbe6b64ec6cd5bd436107a15d29818949ed4d6`
- AG-AA (directory named ag-z): `1a17900bdfec82f4d54b3ed4fb360a8ec9ed3146`
- AG-AB: `5a968c87f78c2cf80dbf13a696e19ad5f85f0183`

Schema, context loader, and compiled artifacts are byte-identical across all four. AG-Y/AA/AB loaders are byte-identical; compared with AG-V they add explicit repository-root loading and normalized path checks. Y/AA/AB share the updated AG/AAG doctrine; their roadmaps differ with assurance progress. Thus keep AG-Y as the recorded conceptual baseline, with cross-checks against AA and AB: choosing the newest assurance branch would not improve this extracted declaration core. The `main` branch differs and is not the most complete declaration baseline. Additional detached worktrees were inventoried by `git worktree list` but are not used as extraction sources. This is a focused comparison of the reusable core, not a claim that all branches are equivalent.
