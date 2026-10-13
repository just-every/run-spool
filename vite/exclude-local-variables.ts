import type { Plugin } from 'vite'

const localVariables = (fileName: string) => /(?:^|\/)\.dev\.vars(?:\.[^/]*)?$/.test(fileName)

// The Cloudflare plugin serialises .dev.vars, .env or process variables into
// dist/<worker>/.dev.vars for preview. Every build, including a direct
// `vite build`, drops that file before it is written: local credentials never
// reach dist/, and the prerender preview never runs with the loopback-only
// AUTH_ORIGIN.
export function excludeLocalVariables(): Plugin {
  return {
    name: 'rer:exclude-local-variables',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const fileName of Object.keys(bundle)) if (localVariables(fileName)) delete bundle[fileName]
      },
    },
  }
}
