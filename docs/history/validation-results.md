# Early validation record

These checks were run during the toolkit's initial development on 2026-09-09, using Node 22.17.0 on macOS. They answer a practical question: could another project install the package and use it through a realistic sequence of changes?

For current results, run `npm run verify` or inspect the relevant GitHub Actions build. This page is a historical record, not a live test dashboard.

## What worked

A freshly packaged toolkit was installed in a separate temporary project. That project could create a graph before application source existed, then add working code and references to real files. Before a later formatting change, context retrieval returned the relevant rule and the open tone decision.

The example then added formal greetings, updated its graph, detected stale guidance, and regenerated it. Deliberate mistakes were caught: a relationship pointing to a missing idea, a duplicate ID, an implemented record without an implementation reference, and a nonexistent source file. The public JavaScript import and the checked-in example also worked with the installed package.

The 12 focused tests passed, covering record validation, file boundaries, ownership conflicts, context retrieval, generated output, custom paths, safe initialization, and toolkit/skill version alignment. The skill passed its frontmatter validator using a temporary PyYAML 6.0.3 installation; that Python dependency is not needed by users of AG. The inspected private application’s source files remained unchanged.

## A limitation demonstrated on purpose

The test replaced the formatter with code that returned the wrong greeting. AG still passed: the design records were well-formed and their files existed. The application's tests failed. This showed why a passing AG check cannot establish correct behavior or architectural conformance.

No independent Codex-session trial, Filmcraft document modeling, or Windows run was performed in this initial record.

## Packaging checks added afterward

The initial GitHub packaging preparation added MIT licensing and an Actions workflow. Local tests exercised the exact distributable archive, including its license. A mismatched version tag and a modified archive were rejected, and the workflow YAML parsed successfully.

At that point, the first hosted workflow run still awaited the initial push. These local checks did not claim that the configured Linux, Node 24, or hosted macOS jobs had already passed.
