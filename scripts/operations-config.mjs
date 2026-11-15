import { readFile, access } from 'node:fs/promises'
import { validateMailConfiguration } from '../src/auth/mail.server.mjs'

export async function validateConfiguration(env) {
  validateMailConfiguration(env)
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
  if (!/^[a-z][a-z0-9-]*$/.test(config.name) || config.main !== 'src/server.ts' || !/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date)) throw new Error('Invalid Worker configuration')
  await access(new URL('../src/server.ts', import.meta.url))
}
