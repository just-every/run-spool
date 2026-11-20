import { DoorError } from '../../modules/import-kit/src/door/protocol';
import { authorized, loadSnapshot, planRow } from '../../modules/import-kit/src/door/store';
import type { D1Database as ImportDatabase } from '../../modules/import-kit/src/d1/types';
import type { DoorRequest } from '../../modules/import-kit/src/door/types';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { importedAlertTarget } from '../alerts/targets';
import { defaultConfig } from '../alerts/filters';
import { statement as s } from '../alerts/types';
import { importedAlertPrefix, localImportDestination, missingImportDestination } from '../alerts/import-state';
import { destinationKey, type AlertProposal } from './alert-rules';

export const importedRuleId = (proposal: string) => importedAlertPrefix + proposal;
export const importedDestinationId = (rule: string) => rule + '-target';
type ProposalRow = {id:string;project:string;payload:string;source:string};
type NativeRule = {id:string;project:string;revision:number;enabled:number;destination:string;waiting:string|null};

export async function importedRuleStates(db: ImportDatabase, proposals: string[]) {
  if (!proposals.length) return new Map<string, NativeRule>();
  const {results} = await db.prepare(`SELECT r.id,r.project,r.revision,r.enabled,r.destination,m.reason waiting
    FROM alert_rules r JOIN json_each(?) p ON r.id=?||p.value
    LEFT JOIN alert_metric_states m ON m.rule_id=r.id AND m.revision=r.revision AND r.enabled=0`).bind(JSON.stringify(proposals),importedAlertPrefix).all<NativeRule>();
  return new Map(results.map(rule => [rule.id,rule]));
}

export async function approveImportedRules(db: D1Database, request: DoorRequest, session: OwnerSession, planId: string, fingerprint: string) {
  await authorized(request);
  const row = await planRow(request,planId);
  if (!row.job_id || row.fingerprint !== fingerprint) throw new DoorError('alert_review_changed',409);
  const snapshot = await loadSnapshot(request,row);
  const reviewed = snapshot.plan.entries.flatMap(entry => entry.effects.flatMap(effect => {
    const value = effect.value as any;
    return effect.targetKind==='import-proposal'&&value.native.kind==='alert' ? [value.native as ProposalRow] : [];
  }));
  if (!reviewed.length) throw new DoorError('no_alert_proposals',409);
  const live = await s(db,`SELECT p.id,p.project,p.payload,m.source FROM spool_import_proposals p
    JOIN sentry_import_targets m ON m.kind='import-proposal' AND m.id=p.id
    JOIN ik_provenance ip ON ip.target_kind=m.kind AND ip.target_id=m.id AND ip.job_id=? AND ip.reversed=0
    WHERE p.kind='alert' AND p.id IN (SELECT value FROM json_each(?))`,row.job_id,JSON.stringify(reviewed.map(p=>p.id))).all<ProposalRow>();
  const byId = new Map(live.results.map(p => [p.id,p]));
  if (reviewed.some(p => byId.get(p.id)?.payload !== p.payload || byId.get(p.id)?.project !== p.project)) throw new DoorError('alert_review_changed',409);
  const assertions = [s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN (${request.authority.sql})
    AND EXISTS(SELECT 1 FROM ik_jobs WHERE id=? AND state='completed')
    AND NOT EXISTS(SELECT 1 FROM json_each(?) want WHERE NOT EXISTS(
      SELECT 1 FROM spool_import_proposals p JOIN ik_provenance ip ON ip.target_id=p.id AND ip.target_kind='import-proposal'
       WHERE ip.job_id=? AND ip.reversed=0 AND p.id=json_extract(want.value,'$[0]') AND p.payload=json_extract(want.value,'$[1]'))) THEN 1 ELSE 0 END`,
    ...request.authority.params??[],row.job_id,JSON.stringify(reviewed.map(p=>[p.id,p.payload])),row.job_id)];
  const existing = await importedRuleStates(db,reviewed.map(p=>p.id));
  const created = Date.now(), statements:D1PreparedStatement[] = [];
  for (const proposal of live.results) {
    const rule = importedRuleId(proposal.id);
    if (existing.has(rule)) continue;
    const data:AlertProposal = JSON.parse(proposal.payload);
    const source = JSON.parse(proposal.source);
    const destinations = [...new Map(data.destinations.map(d=>[destinationKey(d),d])).values()];
    const target = destinations.length === 1
      ? await importedAlertTarget(db,proposal.project,source.organization,destinations[0].kind,destinations[0].id)
      : null;
    const supported = data.settings !== null && data.omissions.length === 0;
    const destination = target ? importedDestinationId(rule) : destinations.length ? missingImportDestination : localImportDestination;
    const runnable = supported && destination !== missingImportDestination;
    const waiting = runnable ? data.waiting : null;
    if (target) {
      assertions.push(target.guard);
      statements.push(s(db,`INSERT INTO alert_target_destinations(id,project,label,target_type,target,fallthrough,created)
        SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM alert_rules WHERE id=?)`,
        destination,proposal.project,data.name,target.type,target.target,destinations[0].fallthrough??'no_one',created,rule));
    }
    // Keep an inert native row for unsupported settings; an owner can supply
    // expressible settings through the regular rule editor and preview.
    const settings = data.settings ?? { kinds:['new_issue'], config:defaultConfig(), windowMs:60000, threshold:2 };
    statements.push(
      s(db,`INSERT INTO alert_rules VALUES(?,?,1,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
        rule,proposal.project,data.name,Number(runnable&&!waiting),'mail',destination,JSON.stringify(settings.kinds),settings.windowMs,settings.threshold,created,created),
      s(db,`INSERT INTO audit SELECT ?,?,'alert_rule_created',?,? WHERE changes()=1`,
        crypto.randomUUID(),proposal.project,JSON.stringify({rule,revision:1}),created),
      s(db,`INSERT INTO alert_rule_configs SELECT ?,?,1,? WHERE changes()=1 ON CONFLICT(rule_id) DO NOTHING`,
        rule,proposal.project,JSON.stringify(settings.config)),
    );
    if (waiting) statements.push(s(db,`INSERT INTO alert_metric_states SELECT ?,?,1,'ok',NULL,?,?,?,?
      WHERE changes()=1 ON CONFLICT(rule_id) DO NOTHING`,rule,proposal.project,waiting,created,created,created));
    if (runnable && !waiting && settings.kinds.includes('spike')) statements.push(s(db,`INSERT INTO alert_cursors
      SELECT ?,?,1,? WHERE changes()=1 ON CONFLICT(rule_id) DO NOTHING`,rule,proposal.project,Math.floor(created/settings.windowMs)*settings.windowMs));
  }
  try {
    await ownerBatch(db,session,[...assertions,...statements]);
  } catch (error) {
    if (/alert_rule_budget|alert_destination_budget/.test(String(error))) throw new DoorError('alert_capacity_reached',409);
    throw error;
  }
  return {created:(await importedRuleStates(db,reviewed.map(p=>p.id))).size};
}
