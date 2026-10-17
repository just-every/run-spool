import { canonical, hash, scrub } from '../privacy';
import { SentryWireError, type WireObject } from '../sentry/wire';

export const feedbackLimits = { message: 1000, retained: 1000, perMinute: 60 };
export const feedbackCoverage = {
 retained: 'scrubbed description only',
 discarded: ['contact', 'name', 'url', 'screenshots', 'attachments', 'other_metadata'],
 association: 'Only an event retained when feedback arrives can be attached; unknown references are never reassociated.',
};
export type FeedbackInput = { id: string; message: string; eventId: string | null; digest: string };
const eventId = (value: unknown): string => {
 if (typeof value !== 'string' || !/^[a-fA-F0-9]{32}$/.test(value)) throw new SentryWireError('invalid_feedback_event_id', 422);
 return value.toLowerCase();
};

/** Retain an allowlisted description, never the raw report or its contact metadata.
 * The raw canonical digest still distinguishes retries that sanitize identically. */
export async function feedbackInput(raw: WireObject, kind: 'feedback' | 'user_report', envelopeId?: unknown): Promise<FeedbackInput> {
 let id: string, reference: string | null, message: unknown;
 if (kind === 'user_report') {
  reference = eventId(raw.event_id);
  id = 'user-report-' + reference;
  message = raw.comments;
 } else {
  if (raw.type !== undefined && raw.type !== 'feedback') throw new SentryWireError('invalid_feedback_type', 422);
  id = eventId(raw.event_id ?? envelopeId);
  if (envelopeId !== undefined && id !== eventId(envelopeId)) throw new SentryWireError('invalid_feedback_event_id', 422);
  const feedback = raw.contexts?.feedback;
  reference = feedback?.associated_event_id == null ? null : eventId(feedback.associated_event_id);
  message = feedback?.message;
 }
 if (typeof message !== 'string' || !message.trim()) throw new SentryWireError('invalid_feedback_message', 422);
 if (message.length > feedbackLimits.message) throw new SentryWireError('feedback_message_too_large', 413);
 const clean = scrub(message);
 if (!clean.trim()) throw new SentryWireError('invalid_feedback_message', 422);
 return { id, eventId: reference, message: clean, digest: await hash(canonical({ kind, value: raw })) };
}
