# Keep architecture context useful as a project grows

A graph is valuable when someone can find the design relevant to a change without rereading the whole system. AG keeps the authoritative design in one YAML file and generates indexes that make focused lookups cheaper. The authored file keeps the design together; the generated files make it practical to use repeatedly.

## Write once, look up what matters

Run `ag generate` after changing the graph. It validates the declarations and builds these derived views:

| Generated view | What it helps you find |
| --- | --- |
| Graph and neighborhood indexes | An idea and its incoming and outgoing relationships |
| Source-context index | The design associated with a source file |
| Module ownership and cross-module indexes | Responsibilities grouped into modules and the dependencies between them |
| Guardrail index | Rules and the ideas they constrain |
| Source map | A declaration's location by file, section, and stable ID |
| Guidance and summary | A short starting point and an overview of coverage and open questions |
| Compilation metadata | Whether the indexes match the graph, configuration and toolkit version |

Use `ag context --file src/formatter.js`, `--id capability:greet`, `--module module:greetings`, or `--guardrail boundary:presentation` to retrieve a focused view. These example IDs come from hello-world; use your own project's IDs and paths. Read the returned references to understand the relevant design and code.

By default, context returns at most 60 nodes and examines at most 120 relationships. It reports `truncated` when limits leave records out. Narrow the question or adjust `--max-nodes` and `--max-relationships` deliberately. A small answer is useful only if its omissions are visible.

## What the indexes save—and what still costs work

Current indexes avoid reconstructing lookup tables on every load and let focused queries follow the relevant connections. They also spare people and coding agents from consuming the whole graph as context. Missing, stale or damaged indexes fall back to tables built from the authored graph, so the graph remains usable before generation.

Loading still parses and validates the entire authored file, checks its references, and reads and checks the generated indexes. Free-text search scans records. Library callers can reuse a loaded project for several queries; each separate CLI invocation loads again. Indexes reduce repeated work and context size, but do not make every operation independent of graph size.

Generation processes the whole graph and writes all derived views. `ag check` also regenerates the expected contents in memory to detect drift; it is not a cheap metadata-only check. As the graph grows, those operations can become the bottleneck even while focused retrieval remains useful. Measure generation separately from loading and querying before choosing where to optimize.

## Move generation to GitHub Actions when it becomes disruptive

In the large application that first motivated AG, generation moved to GitHub Actions as the workload grew. The same approach is available here: generate for a shared revision in CI and distribute its indexes, instead of requiring each developer or agent session to regenerate that revision locally. This moves the work to a shared runner; it does not make the generation algorithm itself faster.

Copy [the consumer workflow](workflows/generate-architecture.yml) to `.github/workflows/generate-architecture.yml` in your project. It installs your locked dependencies, runs the installed `ag generate`, and uploads the generated directory under `architecture-context-<commit SHA>`. It has read-only repository permissions and does not commit generated files back to your branch.

The runner needs Node/npm even for a Python, Rust or other non-JavaScript application. This can be confined to the AG job; your application’s build and deployment need not adopt Node. See [toolchain impact](languages-and-toolchain.md).

Before enabling it:

1. Commit the project's graph, `ag.config.json`, referenced files, `package.json` and lockfile. With the current tarball installation, also commit the archive referenced by the lockfile so `npm ci` can install it.
2. Adjust the default branch and generated-directory path in the workflow if your project uses different ones. The example expects the configuration at the repository root.
3. If referenced files are produced by a build, add the necessary build step before generation. The template skips dependency lifecycle scripts; adapt that installation step if your project requires them.

`generate` already loads and validates the graph. The workflow does not repeat generation through an immediate `check`. A successful run means it built valid derived output from that checkout. It does not assert that previously committed output was current or that the application follows its design.

This toolkit's own packaging workflow also uploads the hello-world graph's generated files from its Linux/Node 22 verification job, separately from the toolkit tarball. That provides an example of the artifact delivery path. The consumer template operates on your graph using your installed toolkit.

## Use the output from the revision you are working on

Open a successful run of **Generate architecture context**, download its `architecture-context-<commit SHA>` artifact, and extract its files into the directory named by `config.generated`—normally `architecture/generated/`. Keep the JSON files and metadata together, directly inside that directory. Use the checkout and locked toolkit version associated with that run. On pull requests, GitHub's run SHA can identify the tested merge revision rather than the branch tip.

AG checks the declaration fingerprint and toolkit version when loading. If your local graph has changed, an old download will fall back to the local graph. Inspect `readSource` and `fallbackReason` in context JSON to see what happened. Downloads are currently manual; AG does not fetch CI output automatically.

For a follow-on job in the same workflow, GitHub's `download-artifact` action can restore the named artifact to the generated directory before invoking AG. See [GitHub's artifact guide](https://docs.github.com/en/actions/tutorials/store-and-share-data) for transfer and download instructions. The template retains downloads for 30 days; regenerate when an artifact is no longer available.

You can instead commit generated output when reviewing those changes is valuable. In that model, run `ag check` **before** regeneration in CI so stale output fails the check. Choose that review policy knowingly: it still performs the generation work. With CI-produced downloads, developers can leave derived files untracked and use CI output for unchanged revisions, generating locally when they need fresh output before CI finishes.
