import type { Plugin } from 'vite'
import { buildSite } from './docs/site'

// The public docs pages (/docs and /docs/<slug>), rendered from the repository's Markdown whenever Vite loads
// `virtual:spool-docs`: on every build, and in `vite dev` again after a listed Markdown file or docs/site.json changes.
// It also carries the repository URL from rer-project.json, which dev's file serving keeps closed to the Worker.
const id = 'virtual:spool-docs'

export function docsSite(): Plugin {
  let root = process.cwd()
  return {
    name: 'spool:docs-site',
    configResolved(config) { root = config.root },
    resolveId(source) { if (source === id) return `\0${id}` },
    load(module) {
      if (module !== `\0${id}`) return
      const { files, ...site } = buildSite(root)
      for (const file of files) this.addWatchFile(file)
      return `export const repository = ${JSON.stringify(site.repository)};\nexport default ${JSON.stringify(site)};`
    },
  }
}
