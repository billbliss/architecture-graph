# A foundation that can grow with the project

A small example should prove the workflow, not limit the toolkit's design. The first standalone implementation retained the basic lifecycle but omitted important AG infrastructure. This document records what was recovered for 0.2.0 and why.

The design remains in one canonical YAML file. Generated indexes support focused retrieval as it grows; logical modules describe ownership within that graph. See [indexes and generation in CI](indexing-and-ci.md) for how those pieces work together and when to move generation to a shared runner.

| Capability in the predecessor | Standalone treatment | Verification |
| --- | --- | --- |
| TypeScript implementation and typed schemas | Strict TypeScript source, compiled JavaScript, declarations and source maps in package; Zod defines runtime schemas and inferred types | Build plus an external TypeScript consumer |
| Canonical YAML authoring | YAML default; one configured file; existing standalone JSON remains supported | YAML/JSON parity, duplicate keys, comments, invalid documents |
| Stable graph/node/relationship identities | Preserve IDs; add original AG kind vocabulary alongside standalone kinds, without rewriting identities | Ontology fixtures and schema tests |
| Compiled graph, neighborhood and source indexes | Derived index files and checksum metadata; missing/stale/corrupt indexes fall back to canonical declarations | Compiled/fallback parity and corruption tests |
| Stable source locators | Locate by file, section and object ID, not shifting array positions | Insertion and reorder tests |
| Ownership and cross-module dependencies | Optional module declarations within the single graph; imports/exports and membership checked | Cross-module valid/invalid fixtures |
| Focused context and guardrail lookup | Indexed node/file/module/guardrail queries; explicit limits, truncation information and operation counts | Large graph and high-fanout tests |
| Curated agent guidance | Short graph overview with focused retrieval instructions, rather than a full graph dump | Bounded large-graph output |
| Drift and maintenance commands | Preserve validate/generate/check; cover the additional derived files | Lifecycle and packaged consumer tests |
| Project registry, inferred domain clusters and source headers | Replace embedded identities and source-layout heuristics with explicit configuration and module membership; source-file queries use declared references | Custom directory and logical module tests |
| Explorer UI and implementation proof machinery | Excluded by the original mission | No dependency on the private application or assurance runtime |
| Per-module file splitting and composition gates | Considered and rejected in the predecessor | One authored file remains the load boundary |

The reusable concepts are adapted from the predecessor’s schema, compiled-artifact, context-loader and module-manifest implementations. Their project-specific classifications and layout assumptions are not copied into defaults. `docs/history/foundation-source.json` records the exact inspected source revisions and hashes.

Compatibility means the standalone 0.1 graph/configuration data remain readable; it does not mean the predecessor’s YAML is directly loadable. The original vocabulary is accepted explicitly, while lifecycle and reference fields keep the standalone forms. Further migration of the private application is outside scope.

Scalability here means reusable indexes, linear validation, bounded retrieval and bounded guidance, tested on a larger synthetic graph. It does not mean a database, incremental parser, arbitrary query engine, or proof that every large repository's architecture is complete.
