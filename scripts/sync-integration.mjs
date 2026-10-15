import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {deploymentSpec} from './delivery/base/spec.mjs';
import {packagingConfig} from './delivery/base/package.mjs';
import {loadSetupManifest} from './delivery/base/setup-manifest.mjs';

/** The build and Base producer policy own the committed integration contract. */
export async function integrationRecipe(root, write = false) {
  const config = JSON.parse(await readFile(resolve(root, 'scripts/delivery/base/packaging.json'), 'utf8'));
  const spec = await deploymentSpec(root, config.artifact.specInputs);
  const {project, workflow, setup} = packagingConfig(config);
  const selectedSetup = await loadSetupManifest(root, setup);
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
