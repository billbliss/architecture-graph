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

Links between `docs/` pages become site links; links to any other repository file become GitHub links at the commit being built (`CF_PAGES_COMMIT_SHA` on Cloudflare Pages, otherwise `git rev-parse HEAD`).

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

The site deploys to Cloudflare Workers as static assets: `wrangler.jsonc` names the Worker, points it at `dist/` and declares the `architecturegraph.dev` custom domain. There is no Worker script.

Builds are connected in the dashboard under the Worker's Settings, Build, Connect to a repository. Every command starts with `cd site`, so no root-directory setting is needed:

| Field | Value |
| --- | --- |
| Git account / Repository | `billbliss` / `architecture-graph` |
| Production branch | `main` |
| Build command | `cd site && npm run cf:build` |
| Deploy command (production branch) | `cd site && npx wrangler deploy` |
| Preview command (other branches) | `cd site && npx wrangler preview` |
| Build variable | `NODE_VERSION` = `24` |

`cf:build` installs and builds the toolkit in the repository root, installs the site's dependencies and builds the site. A push to `main` deploys to production. Other branches, including pull requests, get a named preview with its own URL through `wrangler preview` (open beta in Wrangler 4.157). `wrangler deploy` creates the custom domain's DNS record and certificate when needed.

To deploy by hand from a checkout: `npx wrangler login`, then `npm run build && npm run deploy` in `site/`. `npx wrangler deploy --dry-run` checks the configuration without publishing.

The viewer at `/view` is a placeholder until delivery stage 3.
