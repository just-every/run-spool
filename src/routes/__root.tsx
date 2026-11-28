import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { fontLinks } from '../base/font-head';
import { DraftProvider } from '../ui/workbench/shared';
import { NotFound, PageError } from '../ui/workbench/NotFound';
import { OwnerEditor } from '../editor/OwnerEditor';
import { workbenchHead, workbenchMountId } from '../ui/workbench/shell-document';
import '../ui/workbench/shell.css';
import '../ui/workbench/views.css';
export const Route = createRootRoute({
  head: () => workbenchHead,
  notFoundComponent: NotFound,
  errorComponent: ({ reset }) => <PageError reset={reset} />,
  component: () => {
    const content = <><DraftProvider><Outlet /></DraftProvider><OwnerEditor /></>;
    if (typeof document !== 'undefined' && document.getElementById(workbenchMountId)) return content;
    return <html lang="en"><head>{fontLinks.map(link => <link key={link.href} {...link} />)}<HeadContent /></head><body>{content}<Scripts /></body></html>;
  },
});
