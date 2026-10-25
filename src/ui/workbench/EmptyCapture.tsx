export function EmptyCapture({ onSetup, waiting = false }: { onSetup: () => void; waiting?: boolean }) {
  return <section className="empty-state"><EmptyStackDrawing />
    <h2><span className="mark">{waiting ? 'Waiting for your first event' : 'No captured errors yet'}</span></h2>
    <p>Connect your application, then trigger an error there. Its first event will appear here.</p>
    <div className="button-row"><button className="primary-button" onClick={onSetup}>Set up capture</button></div>
  </section>;
}

/** Ink drawing of blank stacked stack cards: nothing captured yet. */
function EmptyStackDrawing() {
  return <svg className="empty-illustration" viewBox="0 0 340 220" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M150 12v22M112 30l14 16M188 30l-14 16" />
    <rect x="98" y="62" width="200" height="104" rx="10" strokeDasharray="7 6" />
    <rect x="74" y="80" width="200" height="104" rx="10" strokeDasharray="7 6" />
    <rect x="44" y="98" width="200" height="110" rx="10" fill="var(--paper-raised)" strokeWidth="3" />
    <path d="M66 124h150" strokeWidth="6" /><path d="M66 150h118M66 172h82" />
  </svg>;
}
