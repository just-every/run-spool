// Readable identifier for a project name. The limit mirrors idPattern in src/domain/privacy.ts (1 to 100 of [a-zA-Z0-9._:-]).
const IDENTIFIER_LIMIT = 100;
export function projectIdentifierFromName(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, IDENTIFIER_LIMIT).replace(/-+$/, '');
}
