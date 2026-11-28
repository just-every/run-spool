import { renderToStaticMarkup } from 'react-dom/server';
import type { Plugin } from 'vite';
import { fontLinks } from '../src/base/font-head';
import { WorkspaceOpening } from '../src/ui/workbench/WorkspaceOpening';
import { workbenchHead, workbenchMountId, workbenchShellAsset } from '../src/ui/workbench/shell-document';

/** Emit the opening screen with this build's client entry and its styles. */
export function workbenchShell(): Plugin {
  return {
    name: 'spool-workbench-shell',
    apply: 'build',
    applyToEnvironment: environment => environment.name === 'client',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(chunk =>
        chunk.type === 'chunk' && chunk.isEntry && chunk.facadeModuleId?.endsWith('/src/client.tsx'));
      if (entry?.type !== 'chunk' || !entry.viteMetadata?.importedCss.size) {
        this.error('Workbench shell requires the compiled client entry and its styles');
      }
      const html = <html lang="en">
        <head>
          {workbenchHead.meta.map(tag => tag.title
            ? <title key="title">{tag.title}</title>
            : <meta key={tag.name ?? 'charset'} {...tag} />)}
          {[...fontLinks, ...workbenchHead.links].map(link => <link key={link.href} {...link} />)}
          {[...entry.viteMetadata.importedCss].map(file => <link key={file} rel="stylesheet" href={'/' + file} />)}
        </head>
        <body>
          <div id={workbenchMountId}><WorkspaceOpening /></div>
          <script type="module" src={'/' + entry.fileName} />
        </body>
      </html>;
      this.emitFile({ type: 'asset', fileName: workbenchShellAsset.slice(1) + '.html', source: '<!doctype html>' + renderToStaticMarkup(html) });
    },
  };
}
