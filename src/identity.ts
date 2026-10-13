import type { EditionIdentity } from './base/identity';
import branding from './branding.json';
import site from '../deploy-site.json';

export const identity: EditionIdentity = {
 product: 'Spool', deployment: branding.name,
 purpose: '{deployment} catches your JavaScript errors and points to the exact line in your own source.',
 tagline: 'Spool catches your JavaScript errors and points to the exact line in your own source.',
 signInPath: '/sign-in', runSite: `https://${site.domain}`, installedHome: 'lobby',
 theme: '/rer-theme.css', mark: '/theme/spool-mark.svg', band: '/brand/band.svg', fonts: '/fonts/fonts.css',
};
