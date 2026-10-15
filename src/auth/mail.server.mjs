import { createMailSender } from '../modules/mail/index.mjs'
import { createD1DevelopmentOutbox } from '../modules/mail/src/development/index.mjs'
import { localDevelopmentEnabled } from './local.server.mjs'

// Construct only on a send: first-owner setup never depends on mail credentials.
export function operatorMail(env) {
  if (!env.MAIL_PROVIDER) return undefined
  if (env.MAIL_PROVIDER === 'development') {
    if (env.RER_DEMO !== '1' && !localDevelopmentEnabled(env)) return undefined
    return {
      async send(message) {
        return createMailSender({ provider: 'development', mode: 'development' }, {
          outbox: createD1DevelopmentOutbox({ db: env.DB }),
        }).send(message)
      },
    }
  }
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
