import type { RunData } from '../base/run-site';
import { runPricing } from '../base/run-pricing';
export const run: RunData = {
 name: 'Spool', repository: 'https://github.com/just-every/run-spool',
 clone: 'npx -y @runeditrun/rer dev just-every/run-spool',
 licence: 'MIT', docs: true, paths: { product: 'errors-workbench' }, pricing: runPricing,
};
