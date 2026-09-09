# Modeling with schema 1

A graph contains `schemaVersion: "1"`, `id`, `title`, `description` (scope and exclusions), `nodes`, and `relationships`. See the installed `schema/graph.schema.json` for the complete strict shape. Unknown fields are errors.

Each node has `id`, `kind`, `name`, `description`, `status`, and `references`. IDs use `kind:stable-slug`. Kinds: actor, component, capability, contract, artifact, transform, surface, policy, boundary, decision. Components locate behavior; capabilities describe responsibility. Contracts describe obligations; authorities identify which element determines semantics. Use a decision for a question, alternatives, rationale, and eventual disposition rather than an invented commitment.

Each relationship has `id` (normally `relationship:slug`), `kind`, `from`, `to`, `description` (rationale), `status`, and `references`. IDs are globally unique. Nodes and relationships use proposed, implemented, or unresolved status. Status is a human declaration, not a validation conclusion. Resolved design decisions may stay proposed with their disposition explained, since implemented means there is implementation backing. Unresolved can also label an unchosen structural alternative.

References are `{ "kind": "design" | "implementation", "path": "relative/file", "description": "optional locator or purpose" }`. Every supplied path must be a real file inside the project. Paths cannot contain symlinks, traversal, URLs, or globs. Implemented elements require at least one implementation reference. Proposed/unresolved elements can have no references; explain inference in the description. Do not label a design document as implementation to pass validation.

| Relation | From → to |
| --- | --- |
| owns | actor/component → any element; one declared owner, no cycles |
| provides | component/surface/transform → capability |
| authority_for | actor/component/contract → capability/contract/artifact; one declared authority |
| governed_by | any → policy |
| constrained_by | any → boundary/contract/policy |
| preserves | any → contract/artifact |
| affects | decision → any |
| depends_on, consumes, produces | any → any; describe semantics explicitly |

No self edges. Competing owners or authorities should be unresolved alternatives until decided; unresolved edges do not enter the single-owner/authority check. Missing ownership is permitted and may be an intentional scope limit or a question to review. The toolkit does not infer source coverage, detect every semantic contradiction, or enforce runtime boundaries.
