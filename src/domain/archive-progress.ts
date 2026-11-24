// Browser downloads opt into a single whitespace byte before the manifest.
// It can flush the response while D1 prepares the verified archive.
export const archiveProgressHeader = 'X-Spool-Archive-Progress';
export const archiveProgressByte = 0x20;
