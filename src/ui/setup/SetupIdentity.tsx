import { identityMessage } from '../workbench/identityMessage';
import { useEffect, useState } from 'react';
import { Field, type Request } from '../workbench/shared';

export type SetupIdentityValue = { installationName: string; name: string; email: string };

/** Own identity uses native, session-fenced changes, including email step-up. */
export async function initializeSetupIdentity(request: Request, value: SetupIdentityValue) {
  try {
  const [session, access] = await Promise.all([request('/auth/session'), request('/api/organization/me')]);
  if (value.email.trim().toLowerCase() !== session.operator.email) await request('/auth/email', 'POST', { email: value.email });
  if (value.name.trim() !== session.operator.displayName) await request('/auth/display-name', 'POST', { displayName: value.name });
  if (!access.organization) return await request('/api/organization', 'POST', { name: value.installationName });
  if (value.installationName.trim() !== access.organization.name) return await request('/api/organization', 'PUT', { name: value.installationName });
  return access.organization;
  } catch (failure) { throw new Error(identityMessage(failure)); }
}

export function useSetupIdentity(request: Request) {
  const [value, setValue] = useState<SetupIdentityValue>({ installationName: '', name: '', email: '' });
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.all([request('/auth/session'), request('/api/organization/me')]).then(([session, access]) => {
      if (!live) return;
      const localDefault = !access.organization && access.localTransferConfirmation && /^owner@[^@]+\.test$/i.test(session.operator.email);
      setValue({ installationName: access.organization?.name ?? '', name: localDefault ? '' : session.operator.displayName, email: localDefault ? '' : session.operator.email });
      setReady(true);
    }).catch(failure => { if (live) setError(identityMessage(failure)); });
    return () => { live = false; };
  }, [request]);
  return { value, setValue, ready, error, initialize: () => initializeSetupIdentity(request, value) };
}

export function SetupIdentity({ value, onChange, disabled = false }: { value: SetupIdentityValue; onChange: (value: SetupIdentityValue) => void; disabled?: boolean }) {
  return <>
    <Field label="What should we call this?" placeholder="Brightwell Support" autoComplete="organization" required maxLength={120} disabled={disabled} value={value.installationName} onChange={event => onChange({ ...value, installationName: event.target.value })} />
    <Field label="Your name" autoComplete="name" required maxLength={120} disabled={disabled} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} />
    <Field label="Your email" type="email" autoComplete="email" required maxLength={254} disabled={disabled} value={value.email} onChange={event => onChange({ ...value, email: event.target.value })} />
  </>;
}
