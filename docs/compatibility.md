# What AG can tell you—and how to upgrade

AG helps you keep a design record understandable and internally consistent. Knowing the limits of that record is part of using it well.

## A useful check, not a guarantee about the code

Suppose the graph says a formatter owns the wording of a greeting. AG can check that the formatter is recorded, the relationship is valid, and the referenced file exists. It cannot tell whether another part of the application secretly builds its own greeting.

That distinction matters: a well-formed design record can still describe software inaccurately. Marking something `implemented` is a statement by the author, backed by a file reference—not a conclusion reached by AG. A document mislabeled as implementation will not be recognized as such by the toolkit.

Use application tests and review to check behavior. The [hello-world example](../examples/hello-world/README.md) deliberately includes a test in which broken code passes AG checks and fails the application tests.

## Keep the model small enough to be useful

This release reads one JSON graph per configuration. It finds related ideas through their connections and simple text matching. It does not scan source code or automatically extract a design from documents; Codex can help with that through the skill.

The generated briefing includes the whole graph. Model the decisions people need to preserve, rather than cataloging every file. AG cannot discover missing coverage, resolve every contradiction, check source symbols or line numbers, or enforce a runtime boundary.

`ag check` compares the two generated files with the current graph and configuration. It does not check whether source contents changed. Other files in the generated directory are left alone.

## Keep the toolkit and skill together

The toolkit and bundled skill are **0.1.0**. The graph, configuration, and generated-file formats each use version **1**. These format numbers describe how records are stored; they are separate from the toolkit release number.

When upgrading, keep the new package archive and lockfile with your project, replace the copied skill after reviewing local changes, and read the release notes. Run `ag --version` to check the installed toolkit. Then validate the graph and review regenerated guidance.

Unknown graph/configuration versions and unknown fields are rejected so an unsupported change cannot silently disappear. An incompatible format change will need a new format version and a documented migration. During the 0.x series, incompatible command or library changes require a minor release; compatible fixes use a patch release.

This standalone format does not promise compatibility with Alpha Engine's historical YAML or assurance records. Early local verification used Node 22.17.0 on macOS. The repository's Actions workflow is configured for Node 22/24 on Linux and Node 22 on macOS; consult its run results for the build you use. Windows has not been tested.

## Details for integrations

The included JSON schemas describe the supported files. The toolkit's schema checker implements the rules those schemas use; it is not a general-purpose JSON Schema engine. JSON follows Node's parsing behavior: repeated object keys keep the last value, while duplicate graph IDs are checked separately. Use editor checks and review to catch authoring mistakes as well.

The [reference](reference.md) explains the difference between loading a project and validating a graph object directly.

## Where assurance could fit later

Architecture Assurance Graph (AAG) addresses a different question: what evidence shows that an implementation follows the declared design? It is outside this toolkit's current scope.

Stable graph IDs would let a future assurance system attach evidence to a specific design idea even after its source file moves. That system would also need to identify the design version and implementation revision, and decide when evidence has become outdated. The fingerprints in today's generated files identify their inputs; they are not proof of correct behavior. No proof runner or evidence integration is implemented here.
