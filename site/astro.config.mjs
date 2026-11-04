// @ts-check
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// The viewer is a standalone bundle built in ../viewer (npm run viewer). The site serves it at /view/:
// copied into the build output, and served from its dist folder by the dev server.
const viewerDist = fileURLToPath(new URL('../viewer/dist/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

function requireViewer() {
  if (!existsSync(join(viewerDist, 'index.html'))) {
    throw new Error('The viewer is not built. Run `npm run viewer` in site/ (it builds ../viewer) before building the site.');
  }
}

/** @returns {import('astro').AstroIntegration} */
function viewer() {
  return {
    name: 'architecture-graph-viewer',
    hooks: {
      'astro:server:setup': ({ server, logger }) => {
        if (!existsSync(join(viewerDist, 'index.html'))) logger.warn('The viewer is not built; /view/ will be missing. Run `npm run viewer`.');
        server.middlewares.use('/view', (req, res, next) => {
          const path = (req.url ?? '/').split(/[?#]/)[0] ?? '/';
          if (req.originalUrl?.split(/[?#]/)[0] === '/view') {
            res.writeHead(301, { Location: `/view/${req.originalUrl.slice('/view'.length)}` }).end();
            return;
          }
          const file = normalize(join(viewerDist, path === '/' ? 'index.html' : decodeURIComponent(path)));
          if (!file.startsWith(viewerDist) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.writeHead(200, { 'Content-Type': TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream' });
          res.end(readFileSync(file));
        });
      },
      'astro:build:done': ({ dir }) => {
        requireViewer();
        cpSync(viewerDist, fileURLToPath(new URL('view/', dir)), { recursive: true });
      },
    },
  };
}

export default defineConfig({
  site: 'https://architecturegraph.dev',
  build: { format: 'directory' },
  integrations: [viewer()],
});
