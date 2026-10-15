import { demoEffect } from '../modules/demo/index.mjs'
import { createMailSender } from '../modules/mail/index.mjs'
import { localDevelopmentEnabled } from './local.server.mjs'

// Construct only on a send: first-owner setup never depends on mail credentials.
export function operatorMail(env) {
  if (env.RER_DEMO === '1' || localDevelopmentEnabled(env)) {
    return { send: message => demoEffect(
      () => createMailSender({ provider: 'development', mode: 'development' }).send(message),
      () => ({ provider: 'development', status: 'development', providerMessageId: null }),
    ) }
  }
  if (!env.MAIL_PROVIDER || env.MAIL_PROVIDER === 'development') return undefined

  return {
    async send(message) {
      if (!['resend', 'sendgrid', 'cloudflare'].includes(env.MAIL_PROVIDER)) {
        throw new Error('unsupported_mail_provider')
      }
      return createMailSender({
        provider: env.MAIL_PROVIDER,
        mode: 'production',
        apiKey: env.MAIL_API_KEY,
        ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}),
      }).send(message)
    },
  }
}
