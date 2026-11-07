/** Presentation labels leave the stored evidence and exported records intact. */
export const plural = (count: number, singular: string, plural = `${singular}s`) => count === 1 ? singular : plural;
export const words = (value: string) => value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
export const evidenceText = (value: string) => value.replace(/SDK-008:\s*/g, '').replace(/SDK-005 health/g, 'Observed session health').replace(/SDK-005 observed release health/g, 'Observed release health').replace(/SDK-005 session rates/g, 'session rates').replace(/^first retained/, 'First retained').replace(/literal ip_address/g, 'IP address').replace(/Forwarded addresses never resolve \{\{auto\}\}\./g, 'Forwarded addresses are never used to identify a user.');
export const personLabel = (kind: string, name?: string | null) => name || ({ owner: 'Owner', member: 'Former member', service: 'Spool', agent: 'Agent', deploy: 'Deploy key', ingest: 'Capture key', anonymous: 'Visitor' } as Record<string, string>)[kind] || 'Spool';
export function resolutionLabel(mode: string, release?: string | null) {
  return ({ plain: 'Reopens on the next event', current: release ? `Resolved in ${release}` : 'Resolved in the current release', next: release ? `Resolved for the next release after ${release}` : 'Resolved for the next release', named: release ? `Resolved for ${release}` : 'Resolved for the selected release' } as Record<string, string>)[mode] ?? words(mode);
}
