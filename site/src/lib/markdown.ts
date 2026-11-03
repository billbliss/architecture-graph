// Renders repository Markdown (docs/ pages and example READMEs) for the site. Links between pages the
// site publishes become site links; links to any other repository file become GitHub links at the
// commit being built. A relative link to a file that does not exist fails the build.
import { posix } from 'node:path';
import rehypeShiki from '@shikijs/rehype';
import type { Element, Root as HastRoot } from 'hast';
import { toString } from 'hast-util-to-string';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { GITHUB_REPO, githubUrl, readRepo, repoExists, repoPath } from './repo';
import { EXAMPLE_NAMES } from './site-map';

export interface RenderedMarkdown {
  /** Repository-relative source path. */
  source: string;
  title: string;
  html: string;
  headings: { depth: number; id: string; text: string }[];
}

/** The site route for a docs/ Markdown file, or null when the site does not publish it. */
export function docsRoute(path: string): string | null {
  const match = /^docs\/(.+)\.md$/.exec(path);
  if (!match) return null;
  const slug = match[1] === 'README' ? '' : match[1].replace(/\/README$/, '');
  return slug ? `/docs/${slug}/` : '/docs/';
}

/** The site route for a repository file or folder the site publishes as a page, if any. */
export function siteRoute(path: string): string | null {
  const docs = docsRoute(path);
  if (docs) return docs;
  if ((path === 'docs' || path.startsWith('docs/')) && repoExists(`${path}/README.md`)) return docsRoute(`${path}/README.md`);
  const example = /^examples\/([^/]+)\/?(?:README\.md)?$/.exec(path);
  if (example && EXAMPLE_NAMES.includes(example[1])) return `/examples/${example[1]}/`;
  return null;
}

const GITHUB_MAIN = new RegExp(`^${GITHUB_REPO.replace(/[.]/g, '\\.')}/(?:blob|tree)/main/(.+?)(#.*)?$`);

function rewrite(href: string, from: string): string {
  if (href.startsWith('#')) return href;
  const ownRepo = GITHUB_MAIN.exec(href);
  if (ownRepo) {
    // Absolute links to this repository's main branch: prefer the site's own page when there is one.
    return (siteRoute(ownRepo[1].replace(/\/$/, '')) ?? href) + (ownRepo[2] ?? '');
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;
  const [rawPath, ...rest] = href.split('#');
  const hash = rest.length ? `#${rest.join('#')}` : '';
  const target = repoPath(posix.join(posix.dirname(from), decodeURI(rawPath)));
  if (!repoExists(target)) throw new Error(`Broken link in ${from}: ${href} (${target} does not exist)`);
  return (siteRoute(target) ?? githubUrl(target)) + hash;
}

function rehypeRepoLinks(options: { source: string }) {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a' && typeof node.properties.href === 'string') {
        node.properties.href = rewrite(node.properties.href, options.source);
      }
      if (node.tagName === 'img' && typeof node.properties.src === 'string' && !/^[a-z]+:/i.test(node.properties.src)) {
        const target = repoPath(posix.join(posix.dirname(options.source), node.properties.src));
        if (!repoExists(target)) throw new Error(`Broken image in ${options.source}: ${node.properties.src}`);
        node.properties.src = githubUrl(target).replace('/blob/', '/raw/');
      }
    });
  };
}

function rehypeCollect(options: { into: RenderedMarkdown['headings'] }) {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      const depth = /^h([1-6])$/.exec(node.tagName)?.[1];
      if (depth && typeof node.properties.id === 'string') {
        options.into.push({ depth: Number(depth), id: node.properties.id, text: toString(node) });
      }
    });
  };
}

export async function renderMarkdown(source: string, markdown: string): Promise<RenderedMarkdown> {
  const headings: RenderedMarkdown['headings'] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeRepoLinks, { source })
    .use(rehypeCollect, { into: headings })
    .use(rehypeShiki, { themes: { dark: 'github-dark', light: 'github-light' }, defaultColor: false })
    .use(rehypeStringify)
    .process(markdown);
  const title = headings.find(heading => heading.depth === 1)?.text ?? posix.basename(source, '.md');
  return { source, title, html: String(file), headings };
}

const cache = new Map<string, Promise<RenderedMarkdown>>();

/** Renders a repository Markdown file once per build. */
export function renderRepoMarkdown(source: string): Promise<RenderedMarkdown> {
  let rendered = cache.get(source);
  if (!rendered) {
    rendered = renderMarkdown(source, readRepo(source));
    cache.set(source, rendered);
  }
  return rendered;
}
