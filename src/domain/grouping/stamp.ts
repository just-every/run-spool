import { decodedMappings, originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import type { Envelope } from '../privacy';
import { nativeGroupingInfo } from './native';

export const stampGroupingMigration = '0116_stamp_grouping.sql';
const stampIndex = 'event_stamp_grouping';
// SDK 0.1.0 derives this ID from the unstamped JS and map, with fixed 4 and 8 nibbles.
// This identifies candidates only. Other tooling can generate IDs of the same form.
const stampId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

export function beforeStamp(event: Envelope): Envelope | undefined {
  const [top, ...rest] = event.frames;
  if (event.sentry || event.language || !top?.debugId || !stampId.test(top.debugId) || top.line < 2) return;
  const before = { ...event, frames: [{ ...top, line: top.line - 1 }, ...rest] };
  const grouping = nativeGroupingInfo(before);
  if (grouping.basis === grouping.defaultBasis) return before;
}

export async function matchesStamp(db: D1Database, project: string, event: Envelope, raw: string[], unshifted: string[]) {
  const frame = event.frames[0]!;
  // Use the original issue when an operator has moved the occurrence.
  const prior = await db.prepare(`SELECT i.fingerprint, json_extract(e.payload,'$.frames[0].debugId') AS debug
    FROM events e
    LEFT JOIN event_grouping g ON g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence
    JOIN issues i ON i.id=COALESCE(g.original_issue,e.issue)
    WHERE e.project=? AND e.historical=0 AND i.algorithm='js-frame-v1'
      AND json_type(e.payload,'$.sentry') IS NULL AND json_type(e.payload,'$.language') IS NULL
      AND json_extract(e.payload,'$.type')=? AND json_extract(e.payload,'$.frames[0].file')=?
      AND json_extract(e.payload,'$.frames[0].function')=? AND json_extract(e.payload,'$.frames[0].column')=?
      AND (
        (json_extract(e.payload,'$.frames[0].line')=? AND (
          (json_extract(e.payload,'$.frames[0].debugId')=? AND i.fingerprint IN (SELECT value FROM json_each(?)))
          OR
          (json_extract(e.payload,'$.frames[0].debugId') IS NOT NULL AND i.fingerprint IN (SELECT value FROM json_each(?)))
        ))
        OR
        (json_extract(e.payload,'$.frames[0].line')=? AND json_type(e.payload,'$.frames[0].debugId') IS NULL
          AND e.release=? AND e.build=? AND i.fingerprint IN (SELECT value FROM json_each(?)))
      )
    ORDER BY debug IS ? DESC, e.received, e.id LIMIT 1`)
    .bind(project, event.type, frame.file, frame.function, frame.column, frame.line, frame.debugId,
      JSON.stringify([...raw, ...unshifted]), JSON.stringify(unshifted),
      frame.line - 1, event.release, event.build, JSON.stringify(unshifted), frame.debugId)
    .first<{ fingerprint: string; debug: string | null }>();
  if (!prior) return false;
  // The same stamped bundle follows its recorded grouping across releases.
  // A different debug ID needs its own exact release/build map below.
  if (prior.debug === frame.debugId) return unshifted.includes(prior.fingerprint);

  const artifact = await db.prepare('SELECT payload FROM artifacts WHERE project=? AND release=? AND build=? AND debug=?')
    .bind(project, event.release, event.build, frame.debugId).first<{ payload: string }>();
  if (!artifact) return false;
  const map = JSON.parse(artifact.payload);
  if (typeof map.mappings !== 'string') return false;
  const traced = new TraceMap(map);
  if (originalPositionFor(traced, { line: frame.line, column: frame.column! }).line === null) return false;
  // The stamper ends the insertion line with a generated-only segment before
  // starting the shifted code on the next line. A split on the throw's own
  // line preserves the column only when the insertion was at column zero.
  return decodedMappings(traced).slice(0, frame.line - 1).some((segments, index) => {
    const end = segments.at(-1);
    return end?.length === 1 && (index < frame.line - 2 || end[0] === 0);
  });
}

export function predatesStampIndex(manifest: { migrations?: string[]; schemaObjects?: { name: string }[] }) {
  return !!manifest.schemaObjects && !manifest.migrations?.includes(stampGroupingMigration) &&
    !manifest.schemaObjects.some(object => object.name === stampIndex);
}

export function previousStampGroupingObjects<T extends { name: string }>(objects: T[], manifest: Parameters<typeof predatesStampIndex>[0]) {
  return predatesStampIndex(manifest) ? objects.filter(object => object.name !== stampIndex) : objects;
}
