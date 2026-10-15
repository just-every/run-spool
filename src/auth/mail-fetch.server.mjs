// Workers supports only follow/manual, while Base's relay requests redirect:error.
// This fetch dependency implements that policy without following a redirect or
// changing Base's adapter, credentials, envelope or delivery classification.
export async function relayFetch(input, init) {
  if (init.redirect !== 'error') throw new TypeError('mail_redirect_policy_required')
  const response = await fetch(input, { ...init, redirect: 'manual' })
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    throw new TypeError('mail_redirect_refused')
  }
  return response
}
