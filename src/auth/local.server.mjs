// Adapted from Base default-seed's copy: Base imports through its own tree; this seed's copy lives in src/modules.
import { isLoopbackHost } from '../modules/operator-auth/loopback.mjs'

/** Local capabilities require an explicitly configured, exact loopback origin. */
export function localDevelopmentEnabled(env) {
  if (env.AUTH_LOCAL !== 'true' || typeof env.AUTH_ORIGIN !== 'string') return false
  try {
    const url = new URL(env.AUTH_ORIGIN)
    return url.origin === env.AUTH_ORIGIN && !url.username && !url.password &&
      ['http:', 'https:'].includes(url.protocol) &&
      isLoopbackHost(url.hostname)
  } catch { return false }
}
