/** Spool's own hosted UI, serialized as a classic script; no Sentry UI is copied. */
export function installReportDialog(config: { eventId: string; endpoint: string; wording: Record<string, string>; style: string }) {
 const previous = document.activeElement as HTMLElement | null;
 const dialog = document.createElement('dialog'), style = document.createElement('style');
 dialog.className = 'spool-report-dialog';
 style.textContent = config.style;
 const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;
 };
 const wording = config.wording;
 const heading = make('h2', wording.title), subtitle = make('p', wording.subtitle);
 heading.id = 'spool-report-title-' + config.eventId;
 dialog.setAttribute('aria-labelledby', heading.id);
 const form = make('form'), descriptionLabel = make('label', wording.labelComments), description = make('textarea');
 description.name = 'comments'; description.maxLength = 1000; descriptionLabel.appendChild(description);
 const consentLabel = make('label'), consent = make('input');
 consentLabel.className = 'spool-report-consent'; consent.type = 'checkbox'; consent.name = 'consent';
 consentLabel.appendChild(consent); consentLabel.appendChild(make('span', 'I consent to sharing this description and the error reference with this application’s team. Name and email are not kept.')); 
 const error = make('p'), success = make('p', wording.successMessage);
 error.setAttribute('role', 'alert'); error.hidden = true; success.setAttribute('role', 'status'); success.hidden = true;
 const footer = make('footer'), close = make('button', wording.labelClose), submit = make('button', wording.labelSubmit);
 close.type = 'button'; submit.type = 'submit'; footer.appendChild(close); footer.appendChild(submit);
 const explanation = make('p', 'Please leave out personal information. Only the description text and the error reference are kept.');
 [descriptionLabel, explanation, consentLabel, error, success, footer].forEach(node => form.appendChild(node));
 [style, heading, subtitle, form].forEach(node => dialog.appendChild(node));
 let sending = false, activeController: AbortController | null = null;
 const dismiss = () => { activeController?.abort(); dialog.close(); dialog.remove(); previous?.focus(); window.postMessage('__sentry_reportdialog_closed__', window.location.origin); };
 close.addEventListener('click', dismiss);
 dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
 // Native modal focus containment also covers keyboard Tab and Shift+Tab.
 form.addEventListener('submit', async event => {
  event.preventDefault(); if (sending) return;
  error.hidden = true;
  const fail = (message: string) => { error.textContent = message; error.hidden = false; };
  if (!description.value.trim()) { fail(wording.errorFormEntry); description.focus(); return; }
  if (!consent.checked) { fail('Consent is required before sending.'); consent.focus(); return; }
  sending = true; submit.disabled = true;
  const controller = activeController = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
  try {
   const payload = JSON.stringify({ event_id: config.eventId, comments: description.value });
   const body = '{}\n' + JSON.stringify({ type: 'user_report' }) + '\n' + payload + '\n';
   const response = await fetch(config.endpoint, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/x-sentry-envelope' }, body, signal: controller.signal });
   const result = await response.json() as { feedback?: { outcome: string }[]; reason?: string };
   if (!response.ok || !result.feedback?.some(report => ['accepted', 'duplicate'].includes(report.outcome))) {
    fail(response.status === 429 ? 'Too many reports were sent. Please try again in a minute.' : wording.errorGeneric);
   } else {
    descriptionLabel.hidden = true; explanation.hidden = true; consentLabel.hidden = true; submit.hidden = true; subtitle.hidden = true;
    description.value = ''; consent.checked = false; success.hidden = false; close.focus();
   }
  } catch { fail(wording.errorGeneric); }
  finally { clearTimeout(timeout); activeController = null; sending = false; submit.disabled = false; }
 });
 (document.body ?? document.documentElement).appendChild(dialog);
 dialog.showModal(); description.focus();
}
