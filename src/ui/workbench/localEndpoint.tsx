export function isLocalEndpoint(value: string) {
 try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname); }
 catch { return false; }
}

export function LocalCaptureNote({ endpoint }: { endpoint: string }) {
 return isLocalEndpoint(endpoint) ? <p className="muted">This copy runs only on this computer. Your customers’ browsers can’t reach it, so their errors won’t arrive until Spool is online. <a className="inline-link" href="https://run-spool.com/docs/hosting">Put Spool online</a>.</p> : null;
}

export function LocalAddressWarning({ endpoint, addresses }: { endpoint: string; addresses: string[] }) {
 return isLocalEndpoint(endpoint) && addresses.some(address => !isLocalEndpoint(address)) ? <p role="status">This address is public but Spool is local, so customers’ errors won’t arrive.</p> : null;
}
