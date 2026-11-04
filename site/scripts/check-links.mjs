// Fails the build when a page links to a site page, file or heading that does not exist. Runs over the
// built output, so it covers links rewritten from docs/ as well as links written in site pages.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const pages = new Map();

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.html')) pages.set(path, readFileSync(path, 'utf8'));
  }
}
walk(dist);

const decode = text => text.replaceAll('&amp;', '&').replaceAll('&#x26;', '&').replaceAll('&quot;', '"');
const idsCache = new Map();
function ids(file) {
  if (!idsCache.has(file)) {
    const html = pages.get(file) ?? '';
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => decode(match[1]))));
  }
  return idsCache.get(file);
}

function target(pathname) {
  const path = join(dist, decodeURIComponent(pathname));
  if (existsSync(path) && statSync(path).isFile()) return path;
  for (const candidate of [join(path, 'index.html'), `${path}.html`]) if (existsSync(candidate)) return candidate;
  return null;
}

const problems = [];
for (const [file, html] of pages) {
  const from = '/' + relative(dist, file);
  for (const match of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = decode(match[1]);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
    const url = new URL(raw, `https://site.invalid${from}`);
    const page = url.pathname === from ? file : target(url.pathname);
    if (!page) { problems.push(`${from}: ${raw} does not exist`); continue; }
    const hash = decodeURIComponent(url.hash.slice(1));
    if (hash && page.endsWith('.html') && !ids(page).has(hash)) problems.push(`${from}: ${raw} has no heading or element #${hash}`);
  }
}

if (problems.length) {
  console.error(`Broken links:\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`Checked links in ${pages.size} pages.`);
