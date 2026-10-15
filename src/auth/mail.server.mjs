import { createMailSender } from '../modules/mail/index.mjs'
import { localDevelopmentEnabled } from './local.server.mjs'
import { relayFetch } from './mail-fetch.server.mjs'

export function productionMailConfig(env) {
  return {
    provider: env.MAIL_PROVIDER,
    mode: 'production',
    apiKey: env.MAIL_API_KEY,
    ...(env.MAIL_PROVIDER === 'rer' ? { relayUrl: env.MAIL_RELAY_URL } : {}),
    ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}),
  }
}

// Construct only on a send: first-owner setup never depends on mail credentials.
export function operatorMail(env) {
  if (env.RER_DEMO === '1' || localDevelopmentEnabled(env)) {
    return createMailSender({ provider: 'development', mode: 'development' })
  }
  if (!env.MAIL_PROVIDER || env.MAIL_PROVIDER === 'development') return undefined

  return {
    async send(message) {
      // Native sign-in adds this SMTP hint; RER owns the relay's SMTP headers.
      // Leave every other header/feature to Base's ordinary validation.
      if (env.MAIL_PROVIDER === 'rer' && message.headers?.['Auto-Submitted'] === 'auto-generated') {
        const { 'Auto-Submitted': _, ...headers } = message.headers
        message = { ...message, headers }
      }
      return createMailSender(productionMailConfig(env),
        env.MAIL_PROVIDER === 'rer' ? { fetch: relayFetch } : {}).send(message)
    },
  }
}
