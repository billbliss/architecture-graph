# Filmcraft adoption

Filmcraft's design documents have not been provided to this project, so no Filmcraft architecture is asserted here. Adoption starts with those documents, not with a copied hello-world model.

1. Install the private tarball and companion skill using the quickstart. Create `graph:filmcraft` in the Filmcraft repository, preserving its existing instructions and layout.
2. Inventory the actual requirements/design documents and identify durable responsibilities, contracts, ownership and semantic authority. Record scope and explicit exclusions. Avoid one node per paragraph, screen or file.
3. Produce a small proposed graph with real design references. Record incompatible requirements and open choices as unresolved decisions, with `affects` relationships to the concepts they influence. Clearly label inferences. Do not invent code or select a technology merely to satisfy validation.
4. Review a representative workflow with a maintainer: can they recover its responsibilities, authoritative semantics, boundary obligations, and unresolved choices from context? This review assesses usefulness that schema validation cannot measure.
5. Generate guidance, add the short AG project instruction, and commit declarations/configuration with the documents. Resolve blocking product questions through normal project decisions; keep other uncertainty explicit.
6. When implementation begins, retrieve context before changes. Add real implementation references, update lifecycle status and contracts, run application checks separately, then validate/generate/check AG. Preserve stable IDs when files move.

First adoption milestone: a documents-only graph a Filmcraft maintainer recognizes, with uncertainty visible, useful context for one planned change, and no fabricated implementation. AAG integration can be considered separately once implementation and a concrete assurance need exist.
