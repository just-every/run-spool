import type { DevPersona } from '../modules/operator-auth/dev/index.mjs';
// Local dev personas: real operators at <as>@dev.localhost, created only by local dev sign-in
// and suspended in exports. Spool serves one owner, so the persona that matters is the
// signed-in operator who is not the owner: the workbench and every API stay closed to it.
export function devPersonas(): DevPersona[] {
 return [{ as: 'member', role: 'member', displayName: 'Dev member' }];
}
