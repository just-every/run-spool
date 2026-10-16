import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { fontLinks } from '../base/font-head';
import { DraftProvider } from '../ui/workbench/shared';
import { NotFound, PageError } from '../ui/workbench/NotFound';
import { OwnerEditor } from '../editor/OwnerEditor';
import '../ui/workbench/shell.css';
import '../ui/workbench/views.css';
const font = (file: string) => ({ rel: 'preload', href: `/fonts/${file}.woff2`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const });
export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: 'Spool · Issues' }],
    links: [font('zilla-slab-latin-700-normal'), font('ibm-plex-sans-latin-400-normal'), font('ibm-plex-mono-latin-500-normal'), { rel: 'stylesheet', href: '/theme/spool.css' }, { rel: 'icon', href: '/theme/spool-mark.svg', type: 'image/svg+xml' }],
  }),
  notFoundComponent: NotFound,
  errorComponent: ({ reset }) => <PageError reset={reset} />,
  component: () => <html lang="en"><head>{fontLinks.map(link => <link key={link.href} {...link} />)}<HeadContent /></head><body><DraftProvider><Outlet /></DraftProvider><OwnerEditor /><Scripts /></body></html>,
});
