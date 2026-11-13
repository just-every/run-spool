// Dev credentials count only on requests admitted by the local entry. Owner
// shortcuts require the key gate; a product may additionally scope a verified
// invitation or session to its own membership. Only the local-only dev layer
// (./dev/) registers that check. A production Worker never loads the layer, so
// every dev credential is refused there.
let admission = null;
export function registerDevAdmission(check) { admission = typeof check === 'function' ? check : null; }
export async function devAdmitted(request, credential) {
  if (!admission) return false;
  try { return (await admission(request, credential)) === true; } catch { return false; }
}
