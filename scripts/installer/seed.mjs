import * as model from './ui/seed.mjs';
import { adapter, install } from './local.mjs';
export function createSeed() {
 return { product: model.product.name, setup: { manifestFile: 'rer-setup.json' },
  browserModule: 'scripts/installer/ui/seed.mjs', background: 'scripts/installer/ui/background.svg',
  features: adapter.features, settings: adapter.settings, supplied: adapter.supplied,
  ownerBootstrap: adapter.ownerBootstrap, install };
}
