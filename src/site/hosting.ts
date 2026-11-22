/// <reference types="vite/client" />
import hostedGuide from '../../docs/HOSTED.md?raw';
import { renderMarkdown } from '../../vite/docs/markdown';
import { hostingPageHtml } from '../base/hosting-page';
import type { SiteContext } from '../base/run-site';
import { identity } from '../identity';
import { releaseClone, run, withReleaseInstall } from './run';

const guideSource = `${run.repository}/blob/main/docs/HOSTED.md`;
const firstInstall = /^1\. Set `SPOOL_TAG`[^\n]*\n\n   ```sh\n   test -n [^\n]+\n   cd run-spool &&$/m;

function cloudflareGuide() {
 if (!firstInstall.test(hostedGuide)) throw new Error('The Spool hosting guide is missing its tagged first-install step.');
 const markdown = hostedGuide.replace(firstInstall, () => [
  '1. Install and set up the latest stable Spool release on this computer.',
  '',
  '   ```sh',
  `   ${releaseClone} &&`,
  '   cd run-spool &&',
 ].join('\n'));
 const { html } = renderMarkdown(markdown, target => target.startsWith('#') ? target : new URL(target, guideSource).href);

 // Keep the shared hosting layout and copy behavior around the repository guide.
 const content = html
  .replace(/^<h1 [^>]*>[^<]*<\/h1>\n/, '')
  .replace(/<(\/?)(h2)\b/g, '<$1h3')
  .replace(/<pre tabindex="0" data-language="sh"><code>([\s\S]*?)<\/code><\/pre>/g, (pre, code: string) => (
   `<div class="code">${pre}<button class="copy" type="button" hidden data-copy="${code}">Copy</button></div>`
  ));
 return `<section class="diy hosting-guide" aria-labelledby="diy"><h2 id="diy">Put it online yourself</h2>${content}</section>`;
}

export function spoolHostingPage({ hosting, contract }: Pick<SiteContext, 'hosting' | 'contract'>) {
 return withReleaseInstall(hostingPageHtml(identity, run, hosting ?? null, contract))
  .replace('<body>', '<body class="site-hosting">')
  .replace(/<p class="alt"><span>Already have Node 22 or later\?<\/span>.*?<\/p>/, '<p class="alt"><a href="/run">Other ways to run locally</a></p>')
  .replace('To start it again later, run the same line from the same folder.', 'To start it again later, run <code>~/.local/bin/rer dev --host localhost</code> from the <code>run-spool</code> folder.')
  .replace(/<section class="diy" aria-labelledby="diy">[\s\S]*?<\/section>/, cloudflareGuide);
}
