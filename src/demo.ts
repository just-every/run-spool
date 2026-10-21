import type { Json } from './modules/import-kit/src/types';
import type { Bindings } from './auth/bindings';
import { sentryTargets } from './domain/sentry-import/targets';
import { canonical, grouping, hash } from './domain/privacy';
import { historySeed } from './demo/history';
import { demoProject } from './demo/environment';
import { groups, releases, sampleEvent } from './demo/data';
import { seedWorkspace, seedRecentCapture } from './demo/workspace';
import { ensureShortIds } from './domain/short-ids/assign';

/** Historical sample evidence through Spool's native import store adapter.
 * No admission budget is bypassed and no alert is fabricated for old events.
 * Fixed identities plus absent-only writes make partial and repeated runs safe.
 */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
 if (env.RER_DEMO !== '1') return;
 if (!ownerEmail || ownerEmail !== env.OWNER_EMAIL) throw new Error('Demo owner mismatch');
 const db = env.DB, destination = 'spool-owner';
 const read = (kind: string, id: string) => sentryTargets.read(db, destination, kind, id);
 const put = async (kind: string, id: string, native: Record<string, Json>) => {
  if (await read(kind, id)) return;
  const statements = sentryTargets.write({ destination, targetKind: kind, targetId: id, revision: 'demo-v1', value: { native, source: null } });
  await db.batch(statements.map(({ sql, params }) => db.prepare(sql).bind(...params ?? [])));
 };
 const day = 86_400_000;
 await put('project', demoProject, { id: demoProject, name: 'Cedar Market · Storefront', created: now.getTime() - 7 * day });
 const project = (await read('project', demoProject))!.value as { native: { created: number } };
 // Persisted project creation anchors a resumed run to the same event times.
 const start = project.native.created;
 for (const [index, release] of releases.entries()) {
  await put('release', JSON.stringify([demoProject, release.name]), { project: demoProject, ...release, seq: index + 1, created: start + index * 2 * day });
 }
 await seedWorkspace(env, start);
 const history = await historySeed(db, demoProject);
 for (const [groupIndex, group] of groups.entries()) {
  const { algorithm, basis } = grouping(sampleEvent(group, groupIndex, 0));
  const fingerprint = await hash(basis), issue = await hash(`${demoProject}:${fingerprint}`);
  const first = start + groupIndex * 900_000, last = start + 7 * day - (groupIndex + 1) * 1_800_000;
  await put('issue', issue, { id: issue, project: demoProject, fingerprint, algorithm,
   title: `${group.type}: ${group.message}`, state: group.state, revision: 1, count: group.count,
   first_seen: first, last_seen: last, resolved_seq: group.state === 'resolved' ? 3 : null, latest_release_seq: 3 });
  for (let index = 0; index < group.count; index++) {
   const event = sampleEvent(group, groupIndex, index);
   if (history.contains(event.eventId)) continue;
   await history.add({ id: event.eventId, project: demoProject, issue, release: event.release,
    release_seq: releases.findIndex(release => release.name === event.release) + 1, build: event.build,
    environment: event.environment, payload: JSON.stringify(event), digest: await hash(canonical(event)),
    diagnostic: JSON.stringify(await history.diagnose(event)),
    received: Math.round(first + (last - first) * index / (group.count - 1)), occurrence: crypto.randomUUID(), historical: 1 });
  }
 }
 await history.flush();
 await seedRecentCapture(env);
 // Sample issues come in through the import adapter and take short IDs like imported history.
 await ensureShortIds(db);
}
