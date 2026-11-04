import { useState } from 'react';

/** Quote the complete email so copying the command never interprets shell input. */
export function LocalInvitationSignIn({ email }: { email: string }) {
 const [status, setStatus] = useState('');
 const command = `rer dev --as '${email.replaceAll("'", "'\\''")}'`;
 return <div className="callout">
  <p>No email was sent. Run this in the Spool project folder on this computer, then open the private <code>RER_OPEN</code> link it prints to sign in as {email}.</p>
  <pre aria-label={`Local sign-in command for ${email}`}>{command}</pre>
  <button className="text-button" type="button" onClick={() => void navigator.clipboard.writeText(command).then(() => setStatus('Command copied.'), () => setStatus('Select and copy the command above.'))}>Copy sign-in command</button>
  {status && <p role="status">{status}</p>}
 </div>;
}
