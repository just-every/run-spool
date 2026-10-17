import { objectJson, SentryWireError } from './wire.ts';
import { scrub } from '../scrub.ts';

// Reports describe losses before transport, not accepted or billable events.
// Keep only bounded protocol tokens and quantities; never retain report text.
const token = /^[a-z][a-z0-9_]{0,31}(?![\s\S])/;
const maximumQuantity = 2147483647;
export function isClientReportOutcome(reason: unknown): reason is string {
 if (reason === 'client_report_invalid') return true;
 if (typeof reason !== 'string') return false;
 const parts = reason.split(':');
 return parts.length === 3 && parts[0] === 'client_discarded' && token.test(parts[1]) && token.test(parts[2]) && scrub(reason) === reason;
}
export function clientReportCounts(bytes: Uint8Array): Map<string, number> {
 const invalid = () => new SentryWireError('client_report_invalid', 422);
 if (bytes.byteLength > 65536) throw invalid();
 let report;
 try { report = objectJson(bytes); } catch { throw invalid(); }
 if (typeof report.timestamp !== 'number' || !Number.isFinite(report.timestamp) || report.timestamp < 0 ||
     !Array.isArray(report.discarded_events) || report.discarded_events.length > 100) throw invalid();
 const counts = new Map<string, number>();
 for (const item of report.discarded_events) {
  if (!item || typeof item !== 'object' || Array.isArray(item) ||
      typeof item.reason !== 'string' || !token.test(item.reason) ||
      typeof item.category !== 'string' || !token.test(item.category) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > maximumQuantity) throw invalid();
  const reason = `client_discarded:${item.category}:${item.reason}`;
  if (!isClientReportOutcome(reason)) throw invalid();
  const quantity = (counts.get(reason) ?? 0) + item.quantity;
  if (quantity > maximumQuantity) throw invalid();
  counts.set(reason, quantity);
 }
 return counts;
}
