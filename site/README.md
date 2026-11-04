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

## Cloudflare Pages

Connect the GitHub repository in the Cloudflare dashboard (Workers & Pages, Create, Pages, Connect to Git) with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | Astro |
| Root directory | `site` |
| Build command | `npm run pages:build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `24` |

Pages installs the site's dependencies, then `pages:build` installs and builds the toolkit in the repository root and builds the site. Pull requests get preview deployments; `main` deploys to production. Add `architecturegraph.dev` under the project's Custom domains once the first production build succeeds.

The viewer at `/view` is a placeholder until delivery stage 3.
