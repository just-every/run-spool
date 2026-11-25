import { createMailSender, MailValidationError } from '../modules/mail/index.mjs'
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

// MAIL_RECIPIENTS=owner: every message this installation sends goes to OWNER_EMAIL alone. Any other recipient is refused before
// a provider is called, so invitations, team and digest mail and other alert destinations can never reach anyone else.
const mailbox = value => {
  const text = String(value).trim(), open = text.lastIndexOf('<')
  return (text.endsWith('>') && open >= 0 ? text.slice(open + 1, -1) : text).trim().toLowerCase()
}
export function recipientsAllowed(env, recipients) {
  if (env.MAIL_RECIPIENTS !== 'owner') return true
  const owner = env.OWNER_EMAIL ? mailbox(env.OWNER_EMAIL) : ''
  return Boolean(owner) && recipients.length > 0 && recipients.every(value => mailbox(value) === owner)
}

// MAIL_RECIPIENTS=owner: only the owner, at OWNER_EMAIL, is mailed a sign-in link. Any other address, a member's included,
// gets the same accepted answer a stranger gets and no mail, so the sign-in form reveals no account.
export function ownerOnlySignIn(env) {
  if (env.MAIL_RECIPIENTS !== 'owner' || mailSuppressed(env)) return undefined
  return ({ email, operator }) => operator?.role === 'owner' && recipientsAllowed(env, [email])
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
      if (!recipientsAllowed(env, [...(message.to ?? []), ...(message.cc ?? []), ...(message.bcc ?? [])])) throw new MailValidationError('recipient_not_owner')
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
  if (env.MAIL_RECIPIENTS !== undefined && !['', 'any', 'owner'].includes(env.MAIL_RECIPIENTS)) throw new Error('mail_recipients_invalid')
  validateConfig(productionMailConfig(env))
  parseAddress(env.MAIL_FROM)
}
