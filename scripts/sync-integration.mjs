import {lstat, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseContract} from '../src/base/seed-contract.mjs';
import {validateSetupValue} from './delivery/base/schema/setup-validation.mjs';
import {deploymentSpec} from './delivery/base/spec.mjs';
import {packagingConfig} from './delivery/base/package.mjs';
import {loadSetupManifest} from './delivery/base/setup-manifest.mjs';

// Managed source installs omit repository metadata such as .github. Evidence must
// remain usable there, even when a checkout happens to contain the cited file.
export async function checkInstalledEvidence(root) {
  const contract = await readFile(resolve(root, 'CONTRACT.md'), 'utf8');
  const paths = new Set(parseContract(contract).clauses.flatMap(clause => clause.evidence));
  for (const file of ['CONTRACT.md', 'ACCEPTANCE.md', 'CLAIMS.md']) {
    let text;
    try { text = await readFile(resolve(root, file), 'utf8'); }
    catch (error) { if (file === 'CLAIMS.md' && error.code === 'ENOENT') continue; throw error; }
    // Prose evidence lists supplement the machine-readable Status table. Other
    // prose can name upstream SDK files or routes and is not a source citation.
    for (const block of text.matchAll(/(?:Current )?[Ee]vidence:\s*([^\n]+)/g)) {
      for (const match of block[1].split(/\bGap:/)[0].matchAll(/`([^`]+)`/g)) {
        const path = match[1].split(/[ #]/)[0];
        if (/^(?:\.[\w-]+\/|(?:src|tests|scripts|docs|packages|migrations|public)\/|[\w-]+\.(?:md|json)$)/.test(path)) paths.add(path);
      }
    }
  }
  for (const path of paths) {
    if (path.startsWith('.') || path.startsWith('/') || path.split('/').includes('..')) throw Error(`Evidence is outside installed source: ${path}`);
    try { await lstat(resolve(root, path.replace(/\/$/, ''))); }
    catch { throw Error(`Evidence is missing from installed source: ${path}`); }
  }
  return paths.size;
}

export function checkMailSetup(manifest) {
  const field = name => manifest.fields.find(field => field.name === name);
  validateSetupValue(field('MAIL_PROVIDER'), 'cloudflare');
  const account = field('MAIL_ACCOUNT_ID');
  const token = field('MAIL_API_KEY')?.presentations?.find(p => p.when?.field === 'MAIL_PROVIDER' && p.when.equals === 'cloudflare');
  if (!account?.required || account.kind !== 'text' || account.when?.field !== 'MAIL_PROVIDER' || account.when.equals !== 'cloudflare' || !token?.required) {
    throw Error('Cloudflare mail setup requires its account ID and API token');
  }
}

/** The build and Base producer policy own the committed integration contract. */
export async function integrationRecipe(root, write = false) {
  await checkInstalledEvidence(root);
  checkMailSetup(JSON.parse(await readFile(resolve(root, 'rer-setup.json'), 'utf8')));
  const config = JSON.parse(await readFile(resolve(root, 'scripts/delivery/base/packaging.json'), 'utf8'));
  const spec = await deploymentSpec(root, config.artifact.specInputs);
  const {project, workflow, setup} = packagingConfig(config);
  const selectedSetup = await loadSetupManifest(root, setup, config.artifact.specInputs?.mail);
  const descriptor = selectedSetup
    ? {...project, setup: {path: selectedSetup.path, sha256: selectedSetup.sha256}}
    : project;
  const json = value => JSON.stringify(value, null, 2) + '\n';
  for (const [name, bytes] of [
    ['management/integration/deployment-spec.json', json(spec)],
    ['rer-project.json', json(descriptor)],
    ['.github/workflows/rer-managed.yml', workflow],
  ]) {
    const file = resolve(root, name);
    if (write) {
      await mkdir(dirname(file), {recursive: true});
      await writeFile(file, bytes);
    } else if (await readFile(file, 'utf8') !== bytes) {
      throw Error(`Stale integration ${name}; build the application and regenerate with pnpm integration:sync`);
    }
  }
  return spec;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3 || !['--check', '--write'].includes(process.argv[2])) throw Error('Use --check or --write');
  await integrationRecipe(process.cwd(), process.argv[2] === '--write');
  console.log('Integration deployment spec, setup digest and producer workflow match.');
}
