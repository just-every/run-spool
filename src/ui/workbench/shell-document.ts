export const workbenchShellAsset = '/assets/workbench-shell';
export const workbenchMountId = 'spool-workbench';

const font = (file: string) => ({
  rel: 'preload', href: `/fonts/${file}.woff2`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const,
});

export const workbenchHead = {
  meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'Spool · Issues' }],
  links: [
    font('zilla-slab-latin-700-normal'), font('ibm-plex-sans-latin-400-normal'), font('ibm-plex-mono-latin-500-normal'),
    { rel: 'stylesheet', href: '/theme/spool.css' },
    { rel: 'icon', href: '/theme/spool-mark.svg', type: 'image/svg+xml' },
  ],
};
