import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { anchorsOf, renderMarkdown } from './markdown';
import { PATHS, startLine } from '../../src/base/run-site';
import { run } from '../../src/site/run';
import type { Heading } from './markdown';

// docs/site.json lists the repository Markdown the site publishes, in display order. Every page is rendered here, at
// build time; a link to another published page becomes /docs/<slug>, a link to any other repository file goes to
// GitHub, and a missing file or anchor is a build error. The manifest's githubOnly list names the repository documents
// that stay on GitHub, each with a reason; one that is missing, unexplained or also published is a build error.

export const manifestPath = 'docs/site.json';

export type DocsLink = { unlisted?: boolean; slug: string; label: string; href: string };
export type DocsSection = { title: string; pages: DocsLink[] };
export type DocsPage = DocsLink & { section: string; source: string; title: string; description: string; html: string; toc: Heading[] };
export type DocsSite = { repository: string; sections: DocsSection[]; pages: DocsPage[]; files: string[] };

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const href = (slug: string) => slug ? `/docs/${slug}` : '/docs';
const isFile = (root: string, path: string) => existsSync(join(root, path)) && statSync(join(root, path)).isFile();

export function buildSite(root: string): DocsSite {
  const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
  const repository = String(JSON.parse(readFileSync(join(root, 'rer-project.json'), 'utf8')).sourceRepository).replace(/\/$/, '');
  const problems: string[] = [];
  const entries: (DocsLink & { section: string; source: string })[] = [];
  for (const section of manifest.sections ?? []) for (const page of section.pages ?? []) {
    const { slug = '', label = '', source = '', unlisted = false } = page;
    if (slug && (!slugPattern.test(slug) || slug === 'index')) problems.push(`slug "${slug}" must be lowercase words joined by hyphens`);
    if (entries.some(entry => entry.slug === slug)) problems.push(`slug "${slug}" is used twice`);
    if (!label) problems.push(`page "${slug}" has no label`);
    if (!source.endsWith('.md') || !isFile(root, source)) problems.push(`page "${slug}": ${source} is not a Markdown file in the repository`);
    entries.push({ section: section.title, slug, label, source, href: href(slug), unlisted });
  }
  for (const { source = '', reason = '' } of manifest.githubOnly ?? []) {
    if (!isFile(root, source)) problems.push(`githubOnly: ${source} is not a file in the repository`);
    if (!reason) problems.push(`githubOnly: ${source} has no reason`);
    if (entries.some(entry => entry.source === source)) problems.push(`githubOnly: ${source} is also published`);
  }
  if (entries[0]?.slug !== '') problems.push('the first page must be the docs home (slug "")');
  if (problems.length) throw new Error(`${manifestPath} is invalid:\n- ${problems.join('\n- ')}`);

  const bySource = new Map(entries.map(entry => [entry.source, entry]));
  const anchors = new Map<string, Set<string>>();
  const anchorsFor = (path: string) => anchors.get(path) ?? anchors.set(path, anchorsOf(readFileSync(join(root, path), 'utf8'))).get(path)!;
  const pages = entries.map(entry => {
    const resolve = (target: string) => {
      if (/^(https?:|mailto:|\/)/.test(target)) return target;
      const [path, anchor] = target.split('#');
      const file = path ? normalize(join(dirname(entry.source), decodeURIComponent(path))) : entry.source;
      if (file.startsWith('..') || !existsSync(join(root, file))) { problems.push(`${entry.source}: link to missing ${target}`); return target; }
      if (anchor && file.endsWith('.md') && !anchorsFor(file).has(anchor)) problems.push(`${entry.source}: link to missing anchor ${target}`);
      const published = bySource.get(file);
      if (published) return published.href + (anchor ? `#${anchor}` : '');
      return `${repository}/blob/main/${file}${anchor ? `#${anchor}` : ''}`;
    };
    let markdown = readFileSync(join(root, entry.source), 'utf8');
    if (entry.slug === 'getting-started') {
      // Keep a readable recipe in the Markdown; publish the same RunData-derived line as /run and hosting.
      const recipe = ['```sh', startLine(run), '```', '', `${PATHS.self.requirements} Already have Node 22 or later? \`${run.clone}\` does the same.`].join('\n');
      markdown = markdown.replace(/<!-- rer:start -->[\s\S]*?<!-- rer:end -->/, recipe);
    }
    const rendered = renderMarkdown(markdown, resolve);
    if (!rendered.title) problems.push(`${entry.source} has no level-one heading`);
    // The page shows its own title once; the Markdown's H1 is not repeated in the article.
    const html = rendered.html.replace(/^<h1 [^>]*>.*?<\/h1>\n?/, '');
    return { ...entry, title: rendered.title, description: rendered.description, html, toc: rendered.headings.filter(heading => heading.depth === 2) };
  });
  if (problems.length) throw new Error(`Docs: broken links in the repository Markdown:\n- ${problems.join('\n- ')}`);
  const sections = [...new Set(entries.map(entry => entry.section))].map(title => ({ title, pages: entries.filter(entry => entry.section === title && !entry.unlisted).map(({ slug, label, href }) => ({ slug, label, href })) }));
  return { repository, sections, pages, files: [manifestPath, ...entries.map(entry => entry.source)].map(path => join(root, path)) };
}
