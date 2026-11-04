# Architecture Graph viewer

A standalone static React application that opens an Architecture Graph in the browser: the module map, each module's contracts and their consumers, contract structure and examples, the Atlas of every node, search, and linkable views. It is specified in [the website and viewer specification](../docs/specs/website-and-viewer.md). architecturegraph.dev serves it at `/view/`; nothing in it assumes that host, and its asset paths are relative, so the same build can be served from any folder. It is not part of the npm package.

This version opens the bundled examples listed in [`examples/catalog.json`](../examples/catalog.json). Opening a graph from a URL or a project folder is delivery stage 4.

## How it works

- **Loading.** Every graph opens through `src/load/project.ts`: read the configuration, read and parse the graph, then validate with `@billbliss/architecture-graph/core`, the same validation as `ag validate`. The input is a file source (`kind` and `read`), so a bundled example, a URL and a folder differ only in the source.
- **Bundled examples.** `scripts/bundle-examples.mjs` runs that load path in Node against the real files through a recording file source, and writes what was read to `src/generated/examples/` (not committed). A bundle therefore holds exactly the configuration, graph, sidecars and existence checks the browser needs, and an example that does not validate fails the build. References link to GitHub at the commit being built.
- **Views.** `src/layout/views.ts` decides what each view draws: the module map, inside a module (imports, the module, contracts drawn as edges, and the nodes that use it), a node's neighborhood, and the Atlas. Box sizes are fixed rather than measured, so layout depends on the graph alone.
- **Layout.** `src/layout/layout.ts` lays out the map and module views with [elkjs](https://github.com/kieler/elkjs)'s layered algorithm, which the browser runs in a web worker (`src/layout/engine.ts`). The same input always produces the same positions. The Atlas is a plain grid.
- **Canvas.** [React Flow](https://reactflow.dev/) draws the result. Every node and map count is a button, so it is reachable by keyboard and has an accessible name.
- **State.** The view and selection live in the URL hash, for example `?example=task-manager#module=module:tasks&node=contract:task-changed&tab=example`, so any view can be linked and back and forward move between views.
- **Palette.** `src/palette.css` holds the colors, dark first with a light theme; the site imports it so both match.

## Develop

The viewer uses the toolkit from the repository root, which must be built first. Node 22.23 or later; the site and CI use Node 24.

```sh
cd viewer
npm ci
npm run toolkit   # npm ci and npm run build in the repository root
npm run dev       # bundles the examples, then serves on http://localhost:5173/?example=task-manager
npm test          # loads each example, checks layout determinism, panels, routes and search
npm run build     # bundles the examples, type-checks, and writes dist/
```

To see it inside the site, run `npm run viewer` in `site/`, which installs and builds this package; the site's dev server and build then serve `dist/` at `/view/`.

## Licenses

The bundle includes React and React Flow (MIT) and elkjs (EPL-2.0).
