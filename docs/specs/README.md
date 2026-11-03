# Specifications

Specifications describe a change before it is implemented. Each one states its status, the problem it solves, the exact behavior it adds, and what it deliberately does not establish. Reference and how-to documentation in [`docs/`](../README.md) describes the toolkit as it currently works; a specification becomes reference material only after it is implemented.

| Specification | Status | Summary |
| --- | --- | --- |
| [Contract sidecars](contract-sidecars.md) | Proposed | `schema` and `example` references that attach a JSON Schema and example payloads to a contract, and the checks AG runs on them |
| [Maintaining contract sidecars](sidecar-workflow.md) | Proposed | How the bundled skill creates, backfills and updates sidecars during discovery and everyday changes |

The architecture records for these changes are in [AG's own graph](../../examples/architecture-graph/architecture/graph.yaml) as `decision:contract-sidecars` and `decision:sidecar-maintenance-workflow`.
