const form = document.querySelector('[data-passkey-sign-in]');
if (form && typeof globalThis.PublicKeyCredential?.parseRequestOptionsFromJSON === 'function' &&
    typeof globalThis.PublicKeyCredential?.prototype.toJSON === 'function') {
 const button = form.querySelector('button');
 const message = form.querySelector('[role="alert"]');
 const post = async (action, body) => {
  const response = await fetch('/auth/local/passkey/' + action, {
   method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Passkey request refused');
  return response.json();
 };
 form.hidden = false;
 form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  message.hidden = true;
  try {
   const options = PublicKeyCredential.parseRequestOptionsFromJSON(await post('sign-in', {}));
   const credential = await navigator.credentials.get({ publicKey: options });
   if (!credential) throw new Error('No passkey selected');
   const result = await post('verify', { credential: credential.toJSON(), returnTo: form.elements.returnTo.value });
   location.assign(result.location);
  } catch {
   message.textContent = 'Could not sign in with that passkey. Try again or use the private link from your terminal.';
   message.hidden = false;
   button.disabled = false;
  }
 });
}
