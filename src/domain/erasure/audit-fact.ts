import { auditStatement } from '../audit/record';
import { serviceActor, unidentifiedActor } from '../audit/identity';

/** Commits with the erasure's final batch, whether the request or the scheduler
 * finishes it. The subject and project aliases are fresh: the erased identity's
 * links leave in the same batch, so nothing here can be joined back to it. */
export async function erasureCompletionFact(db: D1Database) {
 return auditStatement(db, { source: 'service', actor: await serviceActor(db, 'erasure'), action: 'erasure.complete', subject: { kind: 'erasure', label: unidentifiedActor().label }, projectLabel: null, outcome: 'succeeded' });
}
