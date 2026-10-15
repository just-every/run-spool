import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { documentBoundary } from './vite/document-boundary'
import { excludeLocalVariables } from './vite/exclude-local-variables'
import { docsSite } from './vite/docs-site'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'

// Only `vite dev` loads the local-only entry and the checkout's dev key; a build keeps src/server.ts
// and never sees either (rer build checks its output).
const local = (name: string) => process.env[name] ? { [name]: process.env[name] } : {}
const serve = { main: './src/server.dev.ts', vars: { ...local('RER_DEV_ORIGIN'), ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY') } }

// Serve application sources and assets; private local state and archives stay closed,
// and a build refuses any archive in its written output.
const allow = ['src', 'public', 'node_modules', 'deploy-site.json']
const deny = ['**/.rer/**', '**/.seed/**', '**/exports/**', '**/*.rer']

export default defineConfig(({ command, isPreview }) => ({
  // The Worker owns preflight: Vite's default CORS middleware otherwise returns 204
  // before project authorization or the native ingest origin policy can run.
  // Private settings change only through `rer setup` while dev is stopped. A change event for
  // .dev.vars that arrives while dev serves (a late file-watch delivery for setup's own write)
  // would make the Cloudflare plugin restart the dev server and drop every request in flight.
  server: { cors: false, fs: { strict: true, allow, deny }, watch: { ignored: ['**/.dev.vars', '**/.dev.vars.*'] } },
  plugins: [documentBoundary(), cloudflare({ inspectorPort: false, viteEnvironment: { name: 'ssr' }, persistState: { path: '.wrangler/state' }, ...(command === 'serve' && !isPreview ? { config: serve } : process.env.RER_DEV_ORIGIN ? { config: { vars: local('RER_DEV_ORIGIN') } } : {}) }), tanstackStart(), react(), excludeLocalVariables(), docsSite(), archiveOutputGuard()],
}))
