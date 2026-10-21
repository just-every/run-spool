import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
export const sdkPath = require.resolve('@sentry/node');

/** The same unmodified-SDK program every time; only the DSN and release (environment variables) differ. */
export async function writeEmitter(dir) {
 const file = resolve(dir, 'emit.mjs');
 await writeFile(file, `import * as Sentry from ${JSON.stringify(sdkPath)};
Sentry.init({dsn:process.env.DSN,release:process.env.REL||undefined,environment:'ci',defaultIntegrations:false});
function charge(account){
  return account.address.city;
}
try{charge({})}catch(e){Sentry.captureException(e)}
await Sentry.flush(5000);
`);
 return file;
}
export function runNode(file, env) {
 return new Promise((done, fail) => {
  const child = spawn(process.execPath, [file], {env: {...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', ...env}, stdio: 'ignore'});
  child.on('error', fail); child.on('close', code => code === 0 ? done() : fail(new Error(`${file} exited ${code}`)));
 });
}
