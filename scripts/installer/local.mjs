import { operatorInstaller, developmentTarget, previewTarget } from '@runeditrun/rer/operator-installer';
import { localInstaller } from '@runeditrun/rer/local-installer';
import { installOperator } from '@runeditrun/rer/operator-install';
import { signIn } from '@runeditrun/rer/adapter-auth';
import { commandAdapter as createCommandAdapter } from '@runeditrun/rer/adapter';
import { ownerDeploy } from '@runeditrun/rer/deploy';
import { inspectExistingState, retirePassword } from './recovery.mjs';
import { spoolPortability } from './portability.mjs';
import * as model from './ui/seed.mjs';

const base = operatorInstaller({ database: 'errors-local', features: model.features, prepare: inspectExistingState });
const lifecycle = localInstaller({ ...base.hooks,
 secrets: { ...base.hooks.secrets, keepExisting: false },
 guard: async context => { await base.hooks.guard(context); await inspectExistingState(context); },
 signIn: async context => {
  await signIn(context, { emailKey: 'OWNER_EMAIL', returnTo: '/setup' });
  if (context.ownerClaimed) await retirePassword(context);
  return context.appUrl;
 },
});
export const adapter = { ...lifecycle, localPrerequisites: base.localPrerequisites };
export const install = (root, input, store, onApp, signal) => installOperator(root, input, store, onApp, signal, lifecycle.hooks);
export const commandAdapter = createCommandAdapter(adapter, {
 dev: developmentTarget, preview: previewTarget, verify: ['pnpm', ['run', 'verify:app']],
 deploy: ownerDeploy('deploy.json', lifecycle), portability: spoolPortability(),
 site: { entry: 'src/site/pages.tsx', output: 'dist/site', declaration: 'deploy-site.json', config: 'vite.site.config.ts' },
 setup: { manifestFile: 'rer-setup.json' }, browserModule: 'scripts/installer/ui/seed.mjs',
 // The production build regenerates the TanStack route tree; preview's fixed-build receipt ignores it.
 generatedOutputs: ['src/routeTree.gen.ts'],
 // Local dev identity: the local-only Worker entry, the build output rer build scans for the dev layer, and the kept end-to-end email-link test.
 devIdentity: { entry: 'src/server.dev.ts', output: ['dist'], emailLinkTest: 'tests/setup-journey.mjs' },
 localOnlyKeys: ['RER_DEV_ORIGIN', 'RER_DEV_IDENTITY'],
 product: model.product.name,
 // Hosted setup defaults to a real provider; this computer's setup answers the development outbox itself.
 input: { names: { email: 'OWNER_EMAIL', name: 'displayName' }, defaults: async () => ({ MAIL_PROVIDER: 'development', MAIL_FROM: 'auth@localhost.test' }) },
});
