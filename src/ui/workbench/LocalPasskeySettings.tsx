import { useEffect, useState } from 'react';

const endpoint = '/auth/local/passkey';

async function passkeyRequest<T>(action: string, body?: object): Promise<T> {
 const response = await fetch(endpoint + action, action ? {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
 } : undefined);
 if (!response.ok) throw new Error('Passkey request refused');
 return await response.json() as T;
}

export function LocalPasskeySettings() {
 const [enrolled, setEnrolled] = useState<boolean>();
 const [busy, setBusy] = useState(false);
 const [notice, setNotice] = useState('');
 const [error, setError] = useState('');
 useEffect(() => {
  if (location.protocol !== 'http:' || location.hostname !== 'localhost') return;
  let mounted = true;
  void passkeyRequest<{ enrolled: boolean }>('').then(data => { if (mounted) setEnrolled(data.enrolled); }, () => {});
  return () => { mounted = false; };
 }, []);
 if (enrolled === undefined) return null;
 const supported = typeof globalThis.PublicKeyCredential?.parseCreationOptionsFromJSON === 'function' &&
  typeof globalThis.PublicKeyCredential?.prototype.toJSON === 'function';

 async function update() {
  setBusy(true);
  setError('');
  setNotice('');
  try {
   if (enrolled) {
    await passkeyRequest('/remove');
    setEnrolled(false);
    setNotice('Passkey removed.');
   } else {
    const options = PublicKeyCredential.parseCreationOptionsFromJSON(await passkeyRequest<PublicKeyCredentialCreationOptionsJSON>('/register'));
    const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential | null;
    if (!credential) throw new Error('No passkey created');
    await passkeyRequest('/confirm', { credential: credential.toJSON() });
    setEnrolled(true);
    setNotice('Passkey added.');
   }
  } catch {
   setError(enrolled ? 'Could not remove the passkey. Try again.' : 'Could not add a passkey. Try again.');
  } finally {
   setBusy(false);
  }
 }

 return <section className="evidence" aria-label="Local passkey">
  <h2>Local passkey</h2>
  <p>Use a passkey to sign in as the owner at this localhost address.</p>
  {enrolled && <p>A passkey is enrolled.</p>}
  {enrolled || supported
   ? <button type="button" className="text-button" disabled={busy} onClick={() => void update()}>{enrolled ? 'Remove passkey' : 'Add passkey'}</button>
   : <p>Open Spool in a browser that supports passkeys to add one.</p>}
  {notice && <p role="status">{notice}</p>}
  {error && <p role="alert">{error}</p>}
 </section>;
}
