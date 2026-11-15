import { createMailSender } from '../modules/mail/index.mjs'
import { validateConfig, parseAddress } from '../modules/mail/src/core/validation.mjs'
import { localDevelopmentEnabled } from './local.server.mjs'

export function productionMailConfig(env) {
  return {
    provider: env.MAIL_PROVIDER,
    mode: 'production',
    apiKey: env.MAIL_API_KEY,
    ...(env.MAIL_PROVIDER === 'rer' ? { relayUrl: env.MAIL_RELAY_URL } : {}),
    ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}),
  }
}

export function mailSuppressed(env) {
  return env.RER_DEMO === '1' || localDevelopmentEnabled(env)
}

// Construct only on a send: first-owner setup never depends on mail credentials.
export function operatorMail(env) {
  if (mailSuppressed(env)) {
    return createMailSender({ provider: 'development', mode: 'development' })
  }
  if (!env.MAIL_PROVIDER || env.MAIL_PROVIDER === 'development' || env.MAIL_PROVIDER === 'none') return undefined

  return {
    async send(message) {
      return createMailSender(productionMailConfig(env)).send(message)
    },
  }
}

// Native operations use the same provider validation as the runtime. Off is a
// deliberate selection and cannot conceal inputs that would still send mail.
export function validateMailConfiguration(env) {
  if (env.MAIL_PROVIDER === 'none') {
    const sending = ['MAIL_API_KEY', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'MAIL_PROVIDER_API_KEY', 'MAIL_ACCOUNT_ID', 'MAIL_RELAY_URL'];
    if (sending.some(name => typeof env[name] === 'string' && env[name].trim())) throw new Error('mail_off_conflict')
    return
  }
  if (mailSuppressed(env)) return
  validateConfig(productionMailConfig(env))
  parseAddress(env.MAIL_FROM)
}
