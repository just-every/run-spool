// A small Markdown renderer for the docs pages, run at build time. It covers what the repository's Markdown uses:
// ATX headings, paragraphs, nested lists, fenced code (also inside list items), block quotes, pipe tables, inline code,
// emphasis, links and autolinks. Raw HTML is always escaped. Links go through `link`, which may rewrite or reject them.

export type Heading = { depth: number; text: string; id: string };
export type Rendered = { html: string; title: string; description: string; headings: Heading[] };
type Context = { link: (href: string) => string; slug: (text: string) => string; headings: Heading[]; firstParagraph: string | null };

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (value: string) => value.replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1').trim();

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens, repeats numbered. */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = plain(text).toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}

function inline(text: string, context: Context): string {
  const pieces = text.split(/(`+[^`]*?`+)/);
  return pieces.map((piece, index) => {
    if (index % 2) return `<code>${escape(piece.replace(/^`+ ?| ?`+$/g, ''))}</code>`;
    let html = escape(piece);
    html = html.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => `<a href="${context.link(url)}">${url}</a>`);
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${escape(context.link(href.replaceAll('&amp;', '&')))}">${label}</a>`);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
    html = html.replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
    return html;
  }).join('');
}

const fence = /^(\s*)(```+|~~~+)\s*([\w-]*)\s*$/;
const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const indentOf = (line: string) => line.match(/^\s*/)![0].length;
const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|'));

function blockList(lines: string[], context: Context): string[] {
  const out: string[] = [];
  let i = 0;
  const startsBlock = (line: string, next = '') => fence.test(line) || heading.test(line) || item.test(line) || /^\s*>/.test(line) || (line.includes('|') && isTableSeparator(next));
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const open = line.match(fence);
    if (open) {
      const [, indent, marker, language] = open;
      const body: string[] = [];
      i++;
      while (i < lines.length && !(fence.test(lines[i]) && lines[i].trim().startsWith(marker))) {
        body.push(lines[i].slice(Math.min(indent.length, indentOf(lines[i]))));
        i++;
      }
      i++;
      out.push(`<pre tabindex="0"${language ? ` data-language="${escape(language)}"` : ''}><code>${escape(body.join('\n'))}</code></pre>`);
      continue;
    }
    const head = line.match(heading);
    if (head) {
      const depth = head[1].length, text = head[2], id = context.slug(text);
      context.headings.push({ depth, text: plain(text), id });
      // A numbered section ("1. Register the release") is a step: its number is drawn on the page's thread.
      const step = depth === 2 ? text.match(/^(\d+)\.\s+(\S.*)$/) : null;
      out.push(step
        ? `<h2 id="${escape(id)}" class="step-heading"><span class="step-no">${step[1]}<span class="visually-hidden">.</span></span>${inline(step[2], context)}</h2>`
        : `<h${depth} id="${escape(id)}">${inline(text, context)}</h${depth}>`);
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].trim() && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${blocks(quoted, context)}</blockquote>`);
      continue;
    }
    if (line.includes('|') && isTableSeparator(lines[i + 1] ?? '')) {
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(`<div class="table-scroll" tabindex="0"><table><thead><tr>${header.map(cell => `<th>${inline(cell, context)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell, context)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const first = line.match(item);
    if (first) {
      const base = first[1].length, ordered = /\d/.test(first[2]);
      const items: string[][] = [];
      while (i < lines.length) {
        const current = lines[i].match(item);
        if (current && current[1].length === base && /\d/.test(current[2]) === ordered) {
          const contentIndent = base + current[2].length + 1;
          const body = [current[3]];
          i++;
          while (i < lines.length) {
            const next = lines[i];
            if (!next.trim()) {
              const after = lines.slice(i + 1).find(candidate => candidate.trim());
              if (after !== undefined && indentOf(after) >= contentIndent) { body.push(''); i++; continue; }
              break;
            }
            if (indentOf(next) >= contentIndent) { body.push(next.slice(contentIndent)); i++; continue; }
            if (item.test(next) || startsBlock(next)) break;
            body.push(next.trim()); i++;
          }
          items.push(body);
          continue;
        }
        if (!lines[i].trim()) { const after = lines.slice(i + 1).find(candidate => candidate.trim()); const next = after?.match(item); if (next && next[1].length === base) { i++; continue; } }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(body => {
        const inner = blocks(body, context);
        // A tight item is one paragraph: render it without the <p>.
        const tight = /^<p>((?:(?!<p>).)*)<\/p>\n?((?:<[uo]l>[\s\S]*)?)$/s.exec(inner);
        return `<li>${tight ? tight[1] + tight[2] : inner}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !(paragraph.length && startsBlock(lines[i], lines[i + 1]))) paragraph.push(lines[i++].trim());
    const text = paragraph.join(' ');
    context.firstParagraph ??= plain(text);
    out.push(`<p>${inline(text, context)}</p>`);
  }
  return out;
}

const blocks = (lines: string[], context: Context) => blockList(lines, context).join('\n');

/** Each step heading and what follows it, up to the next H2, becomes one <section class="step"> on the thread. */
function groupSteps(items: string[]): string[] {
  const out: string[] = [];
  let open = false;
  for (const item of items) {
    const isHeading = item.startsWith('<h2 ');
    if (isHeading && open) { out.push('</section>'); open = false; }
    if (isHeading && item.includes('class="step-heading"')) { out.push('<section class="step">'); open = true; }
    out.push(item);
  }
  if (open) out.push('</section>');
  return out;
}

export function renderMarkdown(source: string, link: (href: string) => string): Rendered {
  const context: Context = { link, slug: createSlugger(), headings: [], firstParagraph: null };
  const html = groupSteps(blockList(source.replace(/\r\n?/g, '\n').split('\n'), context)).join('\n');
  const title = context.headings.find(entry => entry.depth === 1)?.text ?? '';
  return { html, title, description: context.firstParagraph ?? '', headings: context.headings };
}

/** The anchors a Markdown file defines, for checking links into it before it is rendered. */
export function anchorsOf(source: string): Set<string> {
  const slug = createSlugger();
  const anchors = new Set<string>();
  let fenced = false;
  for (const line of source.split('\n')) {
    if (fence.test(line)) fenced = !fenced;
    else if (!fenced) { const head = line.match(heading); if (head) anchors.add(slug(head[2])); }
  }
  return anchors;
}
