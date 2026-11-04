# architecturegraph.dev

The Architecture Graph website, built with [Astro](https://astro.build/) as static pages. It is specified in [the website and viewer specification](../docs/specs/website-and-viewer.md). The site is not part of the npm package.

The build reads `docs/`, `examples/` and `schema/` from this repository directly, so there is one copy of each. It loads every bundled example through the toolkit's own `loadProject`, which runs the same validation as `ag validate`, so the toolkit must be built first.

## Build gates

The build fails when:

- a bundled example graph does not validate, or a complete graph written on a site page (the format page) does not validate;
- a relative link in a rendered docs page or example README points at a repository file that does not exist;
- any built page links to a site page or heading that does not exist (`scripts/check-links.mjs`);
- a top-level `docs/` page is missing from the docs navigation in `src/lib/site-map.ts`;
- the node-kind grouping on the concepts page differs from the kinds in `schema/graph.schema.json`.

Links between `docs/` pages become site links; links to any other repository file become GitHub links at the commit being built (`WORKERS_CI_COMMIT_SHA` on Cloudflare, otherwise `git rev-parse HEAD`).

## Develop

The site uses Node 24 (see `.node-version`); Astro 7 needs Node 22.23 or later.

```sh
cd site
npm ci
npm run toolkit   # npm ci and npm run build in the repository root
npm run dev       # http://localhost:4321
npm run build     # static output in site/dist, then the link check
npm run check     # Astro and TypeScript diagnostics
```

## Cloudflare

The site deploys to Cloudflare Workers as static assets: `wrangler.jsonc` points Wrangler at `dist/` and there is no Worker script. Create the Worker in the dashboard (Workers & Pages, Create, Import a repository) with these settings:

| Setting | Value |
| --- | --- |
| Project name | `architecture-graph` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run cf:build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Path (root directory, under advanced settings) | `site` |
| Production branch | `main` |
| Environment variable (build) | `NODE_VERSION` = `24` |

`cf:build` installs and builds the toolkit in the repository root, installs the site's dependencies and builds the site. Builds on other branches upload a preview version with its own URL instead of deploying. The custom domain `architecturegraph.dev` is declared in `wrangler.jsonc`; `wrangler deploy` creates its DNS record and certificate. A manual deploy from a checkout is `npm run build && npm run deploy` in `site/` after `npx wrangler login`. To check the configuration locally, run `npx wrangler deploy --dry-run` after a build.

The viewer at `/view` is a placeholder until delivery stage 3.
