# Validation results

Executed 2026-09-09 with Node v22.17.0. Run `npm run verify` to reproduce.

- PASS: installed tarball in separate consumer; design-only graph validates before application source exists.
- PASS: initial application runs; installed CLI retrieves formatter contract and unresolved tone decision before change.
- PASS: formal tone change updates code, declarations and guidance; stale generated output detected and repaired.
- PASS: detects dangling relationship.
- PASS: detects duplicate identifier.
- PASS: detects missing implemented reference.
- PASS: detects nonexistent source.
- PASS: intentionally wrong implementation passes AG validation/check but fails application tests, demonstrating the assurance limit.
- PASS: public ESM package export resolves in isolated consumer.
- PASS: checked-in hello-world uses installed public CLI and passes application tests.

These are functional checks of the toolkit and example, not AAG evidence or general architectural conformance.

Additional checks: all 12 focused Node tests pass (schema errors, references and path boundaries, ownership/authority errors, neighborhood lookup, drift, custom layout, initialization preservation, package/skill version alignment, and generated symlink rejection). The companion skill passes the skill-creator `quick_validate.py` validator using temporary PyYAML 6.0.3. PyYAML is a validation-only dependency and is not required by this toolkit or its consumers. Inspected Alpha Engine source hashes remained unchanged at the end of extraction.

Manual limits: no independent Codex-session behavioral trial, Filmcraft document modeling, Windows run, or AAG conformance assessment was performed.

## GitHub packaging preparation

MIT licensing and the `Validate and package` workflow were added. Local checks passed: the 12-test suite, the installed-consumer lifecycle, packaging with checksum/build metadata, and testing the exact distributable tarball (including its LICENSE). Mismatched version tags and a modified tarball were rejected. Workflow YAML parsed successfully. GitHub-hosted Linux/Node 24 and macOS jobs will first run after the initial push; local checks do not claim those hosted jobs have passed.
