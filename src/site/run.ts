import { escape, pipelines, runPageHtml, startLine, type RunData } from '../base/run-site';
import type { SeedContract } from '../base/seed-contract.mjs';
import { identity } from '../identity';
import { runPricing } from '../base/run-pricing';
export const run: RunData = {
 name: 'Spool', repository: 'https://github.com/just-every/run-spool',
 clone: 'npx -y @runeditrun/rer dev just-every/run-spool',
 licence: 'MIT', docs: true, paths: { product: 'errors-workbench' }, pricing: runPricing,
};

// The Run site updates from main. Use a published tag here so the installer
// works even while the next release is being prepared.
export const publishedTag = 'v0.7.17';
export const releaseClone = `git clone --branch ${publishedTag} --single-branch ${run.repository}.git run-spool`;
export const releaseInstall = `${releaseClone} && (cd run-spool && curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev --host localhost)`;

export function spoolRunPage(contract?: SeedContract) {
 const original = startLine(run);
 const details = `<details class="other-ways"><summary>Other ways to run locally</summary><p class="alt"><span>Clone the same release:</span></p><pre><code>${escape(releaseClone)}</code></pre><p class="alt"><span>Then, with rer already installed:</span></p><pre><code>cd run-spool &amp;&amp; ~/.local/bin/rer dev --host localhost</code></pre><p class="alt"><span>Or with Node 22 or later:</span></p><pre><code>cd run-spool &amp;&amp; npx -y @runeditrun/rer dev --host localhost</code></pre></details>`;
 return runPageHtml(identity, { ...run, leadLine: `Install Spool ${publishedTag} on your computer.` }, contract)
  .replace(pipelines(original), () => pipelines(releaseInstall))
  .replace(`data-copy="${escape(original)}"`, () => `data-copy="${escape(releaseInstall)}"`)
  .replaceAll('>rer installs itself<', '>Clones Spool<')
  .replaceAll('>Gets Spool<', '>Installs rer<')
  .replace(/<details class="other-ways">.*?<\/details>/, () => details);
}
