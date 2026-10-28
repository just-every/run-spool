/** Named, dated assertions awaiting the combined Base continuation. These are
 * pending requirements, never skipped tests or alternate implementations. */
export const pendingAssertions=[
 {id:'SPOOL-BASE-TARGET-2026-10-28',source:'Base agent-door/audit.ts',assertion:'Every private read, refusal and effect has a native target in the door audit.'},
 {id:'SPOOL-BASE-RESOURCE-CODE-2026-10-28',source:'Base agent-door/transport.ts',assertion:'Missing and restricted resources return identical JSON-RPC error.data.code.'},
 {id:'SPOOL-BASE-REPLAY-AUTHORITY-2026-10-28',source:'Base agent-door/pipeline.ts',assertion:'Mutation replay rechecks current native authorization before returning a retained outcome.'},
 {id:'SPOOL-BASE-OWNER-ESCALATION-2026-10-28',source:'Base agent-door/conformance/surface.mjs',assertion:'Native owner-only updates with no possible self-widening are not required to invent an escalation mode.'},
 {id:'SPOOL-BASE-REVIEWER-2026-10-28',source:'Base native reviewer lifecycle',assertion:'Native reviewers and real Undo actors complete the full review lifecycle.'},
 {id:'SPOOL-BASE-CATALOGUE-ACK-2026-10-28',source:'Base agent-door/policy-store.ts',assertion:'The adoption acknowledgement lists every declared tool in each class; the pinned implementation truncates each class at twenty tools.'},
 {id:'SPOOL-BASE-PROVIDER-BINDING-2026-10-28',source:'Base cli/agent-door.mjs verification.owner.bindings',assertion:'The disposable native installation can receive a test-only GitHub App binding without reading production keys or adding an application fallback.'},
 {id:'SPOOL-BASE-STALE-INJECTION-2026-10-28',source:'Base agent-door/conformance/journey.mjs:injections',assertion:'Injection checks must preserve real native revision fences and irreversible effects; a second fresh-key write with the already-consumed native revision can truthfully refuse.'},
 {id:'SPOOL-CT-SURFACE-2026-10-28',source:'Spool CONTRACT.md',assertion:'The ct Agent surface and Base event clause are aligned with the current company-policy direction.'},
];
