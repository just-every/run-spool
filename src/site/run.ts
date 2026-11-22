import { escape, PATHS, pipelines, runPageHtml, startLine, type RunData } from '../base/run-site';
import type { SeedContract } from '../base/seed-contract.mjs';
import { identity } from '../identity';
import { runPricing } from '../base/run-pricing';
export const run: RunData = {
 name: 'Spool', repository: 'https://github.com/just-every/run-spool',
 clone: 'npx -y @runeditrun/rer dev just-every/run-spool',
 licence: 'MIT', docs: true, paths: { product: 'errors-workbench' }, pricing: runPricing,
};

// Discover the latest stable tag when the command runs, as in the README.
const findStableTag = String.raw`SPOOL_TAG=$(git ls-remote --refs --tags --sort=-version:refname ${run.repository}.git | awk '$2 ~ /^refs\/tags\/v[0-9]+\.[0-9]+\.[0-9]+$/ && !tag { sub("refs/tags/", "", $2); tag=$2 } END { if (tag) print tag }')`;
export const releaseClone = `${findStableTag} && test -n "$SPOOL_TAG" && printf 'Installing Spool %s\\n' "$SPOOL_TAG" && git clone --branch "$SPOOL_TAG" --single-branch ${run.repository}.git run-spool`;
export const releaseInstall = `${releaseClone} && (cd run-spool && curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev --host localhost)`;

export function withReleaseInstall(html: string) {
 const original = startLine(run);
 return html
  .replace(pipelines(original), () => pipelines(releaseInstall))
  .replace(`data-copy="${escape(original)}"`, () => `data-copy="${escape(releaseInstall)}"`);
}

export function spoolRunPage(contract?: SeedContract) {
 const details = `<details class="other-ways"><summary>Other ways to run locally</summary><p class="alt"><span>Clone the latest stable release:</span></p><pre><code>${escape(releaseClone)}</code></pre><p class="alt"><span>Then, with rer already installed:</span></p><pre><code>cd run-spool &amp;&amp; ~/.local/bin/rer dev --host localhost</code></pre><p class="alt"><span>Or with Node 22 or later:</span></p><pre><code>cd run-spool &amp;&amp; npx -y @runeditrun/rer dev --host localhost</code></pre></details>`;
 return withReleaseInstall(runPageHtml(identity, { ...run, leadLine: 'Install the latest stable Spool release on your computer.' }, contract))
  .replaceAll('>rer installs itself<', '>Clones Spool<')
  .replaceAll('>Gets Spool<', '>Installs rer<')
  .replaceAll(escape(PATHS.self.note), 'A first local start usually takes about a minute. On a busy computer it can take longer: <code>rer dev</code> prints progress every 20 seconds, with the limit to allow.')
  .replace(/<details class="other-ways">.*?<\/details>/, () => details);
}
