# Website and viewer

**Status:** In progress: stage 1 (site skeleton) and stage 2 (browser-safe core) are implemented; the viewer is not. Domain: architecturegraph.dev.

## Goals

The site explains what Architecture Graph is, who it is for and how to start, and hosts a viewer that opens any AG graph in the browser with nothing to install. The viewer is also the clearest demonstration of AG: a visitor who opens the task-manager example should understand the idea in a minute.

Non-goals: editing graphs in the browser, accounts, storing or hosting anyone's graphs, server-side processing of graph content, and analytics on what people load into the viewer.

## Audience and message

The primary audience is developers and technical leads on teams that use coding agents (Claude Code, Codex).

The central message: in the coding-agent era, the best description of a codebase is not the code itself but a compact, expressive specification that stays current. Architecture Graph is that living blueprint. Code is the source of truth for what the system does; the graph is the source of truth for what it is meant to be: who owns each responsibility, which part decides what shared data means, which contracts hold, and what must stay true across boundaries. The agent reads it before a change and maintains it after, in any language.

The site states plainly what AG's checks do and do not establish, as the README and [compatibility page](../compatibility.md) do. The graph records intent; when code and graph disagree, that is drift for people and tests to resolve, not something AG proves either way. Claims about outcomes such as fewer recurring bugs are not made on the site until they are supported by more than one project's experience.

## Pages

| Path | Content |
| --- | --- |
| `/` | Home (below) |
| `/view` | The viewer |
| `/view/local` | The launch page for opening a project folder on this computer (below) |
| `/concepts` | What the graph models and why (below) |
| `/examples` | The task manager, AG's own graph and hello-world: a short description, the README, and "Open in viewer" |
| `/docs/…` | The repository's `docs/` pages, rendered |
| `/format` | The graph format and contract sidecars, with links to the JSON Schemas |

### Home

In order:

1. **Hero.** Headline "The living blueprint for your codebase." Subhead: "Code shows an agent what the system does. Architecture Graph shows what it's meant to be: who owns what, which contracts hold, what must stay true. Compact enough to read before every change, and updated with every change." Two calls to action: Get started (`/docs/getting-started`) and Explore an example (`/view?example=task-manager`). Beside or below it, the **contract graphic**: the task service, the Task changed contract and its four consumers, with structure and example cards read from the real sidecars. Hovering a consumer shows the relationship description.
2. **Architecture, not archaeology.** Without a blueprint, every session digs intent back out of the code. The section names the questions that get lost: who owns this responsibility; which part decides what this value means; what must stay true when this interface changes.
3. **How it works.** Three short steps (record, retrieve before a change, keep current), accompanied by the **workflow animation**: an agent about to change the sync engine runs `ag context`, the related part of the graph lights up as the output arrives, the agent changes the code within the rules and leaves the open decision alone, then runs `ag validate` and `ag check`. The terminal lines are real output captured from the commands; the animation must not show anything AG does not print. It loops, has a replay control, and shows its final state without motion when the visitor prefers reduced motion.
4. **Honest about what it checks.** What validation and check establish, and what they do not, including that sidecar examples matching a schema does not show the code sends that data.
5. **Explore a real graph, then start your own.** Example cards that open the viewer, followed by the install commands and a link to the full guide.

### Concepts

A single page explaining what the graph models, adapted from the Architecture Graph white paper's framing of architecture as meaning rather than structure:

- **Meaning, not structure.** A traditional model says what contains what; the graph says who owns a responsibility, which part is authoritative for a meaning, which contracts hold at a boundary, and what must not be silently changed.
- **The node kinds**, grouped by role: who takes part (actor), where behavior lives (component, surface, adapter, transform), what the system does (capability, workflow), what crosses boundaries (contract, artifact, data object), the rules (boundary, policy, constraint), and the record of design thinking (decision, evidence surface). The distinction between component (structure) and capability (responsibility) gets its own short explanation.
- **Relationships that carry meaning**, especially `owns`, `authority_for`, `provides`, `consumes`, `preserves` and `constrained_by`, and why ownership and authority are checked for conflicts.
- **Status as honesty**: proposed, implemented and unresolved, and why open questions stay visible instead of being guessed.
- **Modules and contracts**: logical boundaries inside one graph, and contract sidecars that show the data crossing them.
- **Why this helps agents**: a compact, authoritative starting point instead of re-deriving intent from the whole codebase each session.

Every example on the page uses the real authored format and is either taken from a bundled example graph or validated during the site build, so a visitor can copy it into a graph that `ag validate` accepts. Vocabulary from the white paper that the toolkit does not support is not shown.

A case study of AG in a production project is deferred until there is more than one project's experience to draw on.

The workflow animation may use `ag context --id component:sync-engine` (the task-manager example has no code, so `--file` would find nothing) or a future example with real code.

## Site architecture

The site lives in this repository under `site/`. Its build reads `docs/`, `examples/` and `schema/` directly, so documentation, examples and the published schema have one copy, and one pull request can change the format, its documentation and the viewer together. Toolkit packaging is unaffected: `site/` is excluded from the npm package.

- **Framework.** [Astro](https://astro.build/) generates static pages and renders the Markdown docs. The home page's contract graphic and animation are small components with no framework requirement.
- **The viewer is a standalone bundle.** It is built as its own static React application with no dependency on Astro or the rest of the site, and the site serves it at `/view`. The same bundle can later be shipped and served by the toolkit (see `ag view` under open questions), so nothing in the viewer may assume it is running on architecturegraph.dev.
- **Viewer libraries.** [React Flow](https://reactflow.dev/) for the interactive canvas and [elkjs](https://github.com/kieler/elkjs) for layered layout, run in a web worker so large graphs do not block the page.
- **Docs rendering.** Links between `docs/` pages become site links. Links to other repository files (source, examples, schema) become GitHub links at the commit the site was built from. Pages under `docs/history/` and `docs/specs/` are published but kept out of the main navigation.
- **Hosting.** Cloudflare Pages builds `site/` on every push. Pull requests get preview deployments; `main` deploys to architecturegraph.dev.
- **Appearance.** Dark first, with a light theme that follows the visitor's system setting and can be switched. The node-kind colors from the viewer form the site's accent palette.

## Viewer

### Loading a graph

All loading happens in the browser; nothing is uploaded.

| Input | Sidecars and references |
| --- | --- |
| `?example=<name>` | Bundled with the site at build time, complete |
| `?url=<url of a graph file>` | The main way to open a remote graph. The viewer discovers the project's configuration (below), so sidecars resolve exactly as AG resolves them |
| `?config=<url of a configuration file>` | For projects whose configuration is not named `ag.config.json` or cannot be discovered |
| Drop or choose a project folder | Through the [local launch page](#opening-a-local-project). Works for any repository, private or public, wherever it is hosted |
| Drop, choose or paste one graph file | No project files are available, so contract panels say sidecars cannot be shown and explain how to load the folder or a URL instead |

**Finding the project root.** References are relative to the folder containing the configuration file, not to the graph file, so the viewer needs the configuration to resolve sidecars. Given a graph URL, it looks for `ag.config.json` in the graph's folder, then in each parent folder in turn. It accepts the first configuration whose `graph` setting resolves to the URL it loaded; that check makes the match exact rather than a guess. The search stops at the repository root for `raw.githubusercontent.com` URLs (owner, repository and ref) and after six levels or at the host root elsewhere. When no configuration matches, the graph still opens, references are shown without links, and contract panels explain that `?config=` will load the sidecars.

The graph format does not record its project root. A root field in the graph would duplicate what the configuration already says and could disagree with it; discovery needs no format change. If discovery proves insufficient, such a field can be added later, with AG checking that it agrees with the configuration.

#### Opening a local project

A local folder is the way to view a private repository: anyone who can clone it can view it, and nothing goes over the network. Because the browser's own prompts are bare and can be alarming, folder loading starts from a launch page at `/view/local` that explains what will and will not happen before any prompt appears:

- **What it reads.** The configuration, the graph and its sidecar files. It checks that other referenced files exist without reading their contents. It does not read the rest of the project.
- **What it does not do.** Nothing is uploaded, sent or stored; the files are read inside this browser tab. Nothing is changed or written. Closing or reloading the tab forgets the folder.
- **What the browser will ask.** A short description of the permission prompt the visitor is about to see, worded for their browser, for example "Let site view files?".
- **Which folder to choose.** The folder that contains `ag.config.json`, usually the repository root.

Folders are read lazily: only the files named above are opened, so a large repository loads as quickly as a small one. The page offers two methods:

- **Drag and drop a folder** onto the page, which works in all major browsers without a permission prompt.
- **Choose a folder**, using the browser's folder-access API where it exists (Chromium-based browsers).

The viewer does not use the older `<input webkitdirectory>` picker, because it lists every file in the folder, dependency folders included, and makes some browsers ask whether to "upload" thousands of files.

After a folder is opened:

- **A folder containing `ag.config.json`.** The viewer uses it. When the folder contains several configurations (for example in subprojects), it lists them and asks which to open.
- **A folder containing a graph but no configuration**, typically `architecture/` chosen instead of the repository root. The graph opens, but files outside the chosen folder, often including sidecars, cannot be read. The viewer says so and offers to choose the parent folder instead.
- **A folder with neither.** The page explains what to choose and offers the bundled examples.

Remote loading uses `fetch`, so the host must allow cross-origin requests. GitHub raw URLs do; when another host refuses, the viewer says so instead of failing silently. GitHub `blob` URLs are rewritten to their raw equivalents. When a graph comes from GitHub, references link to the corresponding files on GitHub.

### Validation

The viewer runs the same validation as `ag validate`, not a second implementation. That requires a browser-safe core in the toolkit (see [changes to AG](#changes-to-ag)). Results appear in a diagnostics panel. A graph with errors still renders when its shape allows, with affected nodes marked; a graph whose shape cannot be read shows only the diagnostics. The viewer states, as the CLI does, that structural validation does not prove implementation conformance.

### Views

The views follow the mockup reviewed during design:

- **Module map (home view).** Modules as boxes, layered automatically so that modules that use others sit above the modules they use. Edges between modules show how many relationships cross in each direction; edges that point upward or both ways are highlighted. Selecting an edge lists every crossing relationship. Each module box shows its node counts by kind, its exports and imports, and its number of open questions.
- **Inside a module.** The module's nodes in the middle, nodes it imports on the left, and nodes in other modules that use it on the right. Contracts whose consumers are outside the module are drawn as edges from provider to consumers, labeled with the contract. Selecting a node draws only its relationships and fades the rest.
- **Contract panel.** Provider and consumers, marked *declared* when consumers have `consumes` or `depends_on` relationships to the contract and *derived* when they are inferred through the provider's capabilities, and tabs for Structure (rendered from the schema sidecar, resolving `$ref`), Example, Guarantees (description, `preserves` relationships and affecting decisions) and Sources.
- **Node panel.** Description, status, module, outgoing and incoming relationships, and references.
- **Atlas.** Every node grouped by module and kind, without edges until a node is selected. Reachable from every view; never the default.
- **Graph without modules.** The map is replaced by the Atlas grouping nodes by kind, and node neighborhoods replace the module view.

Status is visible everywhere: proposed nodes are outlined dashed, unresolved ones in the warning color, implemented ones solid. A legend explains kinds and statuses.

### Navigation and state

- A search box (also ⌘K / Ctrl-K) jumps to any node, relationship or module by name or ID.
- The current view and selection are kept in the URL hash, for example `/view?example=task-manager#module=module:tasks&node=contract:task-changed&tab=example`, so any view can be linked.
- Back and forward move between views.

### Scale, layout and accessibility

- Layout is deterministic: the same graph always lays out the same way. There is no force-directed or animated physics layout.
- The viewer must stay responsive with 1,000 nodes and 4,000 relationships, which is AG's context limit and above the largest known graph (about 640 nodes). The Atlas virtualizes long columns.
- Every node and edge is reachable by keyboard, has an accessible name, and meets WCAG AA contrast in both themes. The canvas has a text alternative listing the selection and its relationships.

## Changes to AG

1. **Browser-safe validation core.** Validation currently reads the file system directly. Split it so the rules run against an abstract file source (`exists(path)` and `read(path)`), with a Node implementation for the CLI and library and a browser implementation for the viewer. Export the browser-safe part as a separate package entry point, for example `@billbliss/architecture-graph/core`, that imports nothing from Node. Sidecar checking moves with it; Ajv, Zod and yaml all run in browsers.
   *Status: implemented in stage 2, with two differences from the text above.* The file source has `kind(path)`, returning `file`, `other` or `missing`, instead of `exists(path)`, because validation must tell a directory from a file. The toolkit ships the Node source and an in-memory source; the folder-handle and `fetch` sources belong to the viewer (stages 3 and 4) and implement the same asynchronous interface. See [the library reference](../reference.md#validating-without-node-the-browser-safe-core).
2. **AG's own graph.** Record this specification as a proposed decision, and a second proposed decision for the browser-safe core affecting the validator. The open question about code-first versus schema-first authoring stays open; the viewer uses the toolkit's validation code, so it does not force a decision.

## Delivery in stages

1. **Site skeleton.** `site/` with Astro, home page with the contract graphic, concepts page, rendered docs, examples page, Cloudflare Pages deployment with previews.
2. **Browser-safe core.** The AG change above, released with tests that run validation in a browser-like environment.
3. **Viewer, bundled examples.** Module map, module view, contract and node panels, Atlas, search, URL state, using the bundled examples only.
4. **Viewer, any graph.** Graph and configuration URLs with configuration discovery, the local launch page and folder loading, single-file loading, diagnostics panel, GitHub source links.
5. **Polish.** The workflow animation, light theme review, accessibility review, performance check against a 1,000-node generated graph.

## Testing

- The site build fails on broken internal links, including links rewritten from `docs/`, and on any concepts-page graph example that does not validate.
- Viewer tests load each bundled example and check counts, layout determinism (the same positions on repeated runs), and that every contract with a schema renders a Structure tab.
- Local-folder tests open the project root, the `architecture/` folder alone (graph opens, sidecars reported unavailable), a folder with two configurations, and a folder with neither, and confirm that only the configuration, graph and sidecar files are read.
- A browser test confirms validation results in the viewer equal `ag validate` for the bundled examples and for deliberately broken fixtures.
- End-to-end tests serve example projects from a local server and check that a graph URL discovers its configuration in the same folder and in a parent folder, that a configuration whose `graph` setting names a different file is skipped, that `?config=` works for a renamed configuration, and that a cross-file `$ref` sidecar resolves.

## Open questions

- **Sharing private graphs.** Loading by URL works only for public repositories and hosts that allow cross-origin requests; a private GitHub repository needs authentication. A local folder already works for anyone with a clone, but cannot be shared as a link. The preferred future direction is an `ag view` command in the toolkit that serves the project locally with the same viewer bundle and opens it, with no tokens or third-party access. GitHub sign-in, which would need a small token-exchange service, is considered only if shareable links to private graphs turn out to be needed; pasting personal access tokens into the site is not planned.

- Should the published JSON Schemas get permanent addresses on the site, such as `architecturegraph.dev/schema/graph/1.json`? Once published, they must never move.
- Should the docs be versioned by release, or always show the latest?
- Should the site use privacy-preserving page analytics (for example Cloudflare Web Analytics), given that graph content is never sent anywhere?
- Should graphs be embeddable in other pages, for example an iframe of the module map in a project's README?
