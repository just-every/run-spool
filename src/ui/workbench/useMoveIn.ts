import { useEffect, useRef, useState } from 'react';
import { useDraft } from './shared';
import { DoorRefusal, door, readImports, repeat, sentryNamespace, undoFromHistory, upload, writeImports } from './move-in-client';
import { PART_BYTES, baseline, empty, readExport, refusal, resumeStep, stoppedNotice, unfinished, type HistoryRow, type Imports, type Job, type Session, type Step } from './move-in-model';

type Focus = 'status' | 'notice' | 'changes' | 'imported';
const moving = (state: string) => ['queued', 'applying', 'undoing', 'rolling_back'].includes(state);
const failed = (error: unknown) => error instanceof DoorRefusal && (error.code === 'import_door_plan_failed' || error.code.startsWith('import_door_apply_'));

/** Move in's controller: the session (memory only, so in-app navigation keeps
 * a review), the door's history, and every action. Loops send one request at a
 * time and stop when the page closes; a return visit resumes from history[]. */
export function useMoveIn(refresh: () => void) {
  const [session, setSession] = useDraft<Session>('move-in', empty);
  const [imports, setImports] = useState<Imports | null>(null);
  const [unavailable, setUnavailable] = useState(false), [ready, setReady] = useState(false);
  const [historyUndo, setHistoryUndo] = useState<{ planId: string; job?: Job } | null>(null);
  const [focus, setFocus] = useState<{ target: Focus } | null>(null);
  const alive = useRef(true), working = useRef(false), go = () => alive.current;
  const update = (change: Partial<Session> | ((current: Session) => Partial<Session>)) => {
    if (alive.current) setSession(current => ({ ...current, ...typeof change === 'function' ? change(current) : change }));
  };
  const replace = (next: Session) => { if (alive.current) setSession(next); };
  const focusOn = (target: Focus) => { if (alive.current) setFocus({ target }); };

  async function load() {
    try {
      const value: Imports = await readImports();
      if (alive.current) setImports(value);
      return value;
    } catch (error) {
      if (error instanceof DoorRefusal && error.code === 'import_door_schema_outdated') setUnavailable(true);
      else refuse(error);
      return null;
    }
  }
  /** A refusal in words, in the status row's place; the loop that met it stops. */
  function refuse(error: unknown, fallback?: Step) {
    if (!alive.current) return;
    if (error instanceof DoorRefusal) {
      const next = refusal(error.code, error.status, error.details, session.facts), changed = next.step === 'changed' && error.code !== 'plan_staging_interrupted_cancel_and_replan';
      update(current => ({ step: next.step ?? fallback ?? current.step, notice: next.notice, stopped: true, part: undefined,
        ...(error.code === 'plan_staging_interrupted_cancel_and_replan' ? { interrupted: error.details?.planId } : {}),
        ...(error.code === 'earlier_import_holds_records' ? { held: error.details?.planIds } : {}),
        ...(changed ? { plan: undefined, planId: undefined, fingerprint: undefined, job: undefined } : {}) }));
      if (error.code === 'owner_required') refresh();
    } else update(current => ({ step: fallback ?? current.step, stopped: true, part: undefined, notice: { title: 'Spool refused this step.', text: (error as Error).message } }));
    focusOn('notice');
  }
  /** Where a job that stopped moving leaves the page. */
  async function settle(namespace: string, planId: string, job: Job) {
    if (moving(job.state)) return update({ job, stopped: true });
    if (job.state === 'completed') {
      const facts = await door(namespace, 'status', { planId }), report = await door(namespace, 'reconcile', { planId });
      update({ step: 'imported', job, approval: facts.approval, reconcile: report, undo: report.undo, notice: undefined, stopped: false });
      focusOn('imported');
    } else if (job.state === 'failed') {
      const facts = await door(namespace, 'status', { planId });
      update({ step: 'failed', job, approval: facts.approval ?? undefined, notice: stoppedNotice(job, facts.failureCode ?? job.error) });
      focusOn('notice');
    } else update({ step: job.state as Step, job, notice: undefined, stopped: false });
    refresh();
  }
  /** A return visit: the newest stopped job takes the top, with Continue or Roll back. */
  async function resume(history: HistoryRow[]) {
    for (const row of unfinished(history)) {
      const facts = await door(row.namespace, 'status', { planId: row.planId }), step = resumeStep(facts.job, facts.undo);
      if (!step) continue;
      return update({ step, namespace: row.namespace, planId: row.planId, fingerprint: row.fingerprint, row, job: facts.job, approval: facts.approval ?? undefined,
        undo: facts.undo, stopped: true, notice: step === 'failed' ? stoppedNotice(facts.job, facts.failureCode ?? facts.job.error) : undefined });
    }
  }
  /** In-app return to a session: re-read its job and, after an import, what blocks Undo now. */
  async function recheck(current: Session) {
    const facts = await door(current.namespace!, 'status', { planId: current.planId });
    update({ undo: facts.undo });
    // Back on an import: the Undo band now says what blocks it, so an earlier notice goes.
    if (current.step === 'imported' && ['completed', 'undoing'].includes(facts.job.state)) return update({ job: facts.job, notice: undefined });
    if (moving(facts.job.state)) return update({ job: facts.job, stopped: true });
    await settle(current.namespace!, current.planId!, facts.job);
    await load();
  }
  useEffect(() => {
    alive.current = true;
    const current = session;
    if (current.step === 'uploading' || current.step === 'planning') update({ step: 'chosen', part: undefined });
    void (async () => {
      const value = await load();
      try {
        if (value && current.planId && current.namespace && ['applying', 'undoing', 'rolling_back', 'imported'].includes(current.step)) await recheck(current);
        else if (value && current.step === 'empty') await resume(value.history);
      } catch (error) { refuse(error); }
      if (alive.current) setReady(true);
    })();
    return () => { alive.current = false; };
  }, []);
  useEffect(() => { if (focus) document.getElementById(`move-in-${focus.target}`)?.focus(); }, [focus]);

  /** One action at a time: Apply and the other primaries are never disabled. */
  const once = (work: () => Promise<unknown>) => async () => {
    if (working.current) return;
    working.current = true;
    try { await work(); } finally { working.current = false; }
  };
  const choose = (file: File) => once(async () => {
    try {
      if (session.step === 'review' && session.planId) await discardPlan(session.namespace!, session.planId);
      const bytes = new Uint8Array(await file.arrayBuffer()), read = readExport(file.name, bytes);
      if ('notice' in read) { replace({ step: 'refused', notice: read.notice }); return focusOn('notice'); }
      const namespace = sentryNamespace(read.facts.slug);
      replace({ step: 'chosen', bytes, facts: read.facts, namespace, baseline: baseline(imports?.history ?? [], namespace) });
    } catch (error) { refuse(error); }
  })();
  async function discardPlan(namespace: string, planId: string) {
    // A plan another tab already discarded is gone either way.
    try { await door(namespace, 'undo', { planId }); } catch (error) { if (!(error instanceof DoorRefusal && error.code === 'plan_not_found')) throw error; }
  }
  const start = once(async () => {
    const { bytes, namespace, interrupted } = session;
    if (!bytes || !namespace) return;
    replace({ step: 'uploading', bytes, facts: session.facts, namespace, part: [1, Math.ceil(bytes.length / PART_BYTES)] });
    focusOn('status');
    try {
      // Compare with the organization's live import as the door holds it now: a catch-up.
      const fresh = await load();
      if (!fresh) return update({ step: 'chosen', part: undefined });
      const compared = baseline(fresh.history, namespace);
      update({ baseline: compared });
      if (interrupted) await discardPlan(namespace, interrupted);
      // The status row names the part being sent: one past the parts the door holds.
      const uploadId = await upload(namespace, bytes, (received, parts) => update({ part: [Math.min(received + 1, parts), parts] }), go);
      if (!alive.current) return;
      update({ step: 'planning', part: undefined });
      const plan = await door(namespace, 'plan', { uploadId, ...(compared ? { catchup: true } : {}) });
      update({ step: 'review', plan, planId: plan.planId, fingerprint: plan.fingerprint });
      focusOn('changes');
    } catch (error) { refuse(error, 'refused'); }
  });
  const discard = once(async () => {
    try {
      await discardPlan(session.namespace!, session.planId!);
      update({ step: 'chosen', plan: undefined, planId: undefined, fingerprint: undefined, notice: undefined });
    } catch (error) { refuse(error); }
  });
  const apply = once(async () => {
    const { namespace, planId, fingerprint } = session;
    if (!namespace || !planId || !fingerprint) return;
    const body = { planId, reviewedFingerprint: fingerprint };
    update({ step: 'applying', job: session.job ?? { state: 'queued', checkpoint: 0, total: session.plan?.counts.unique ?? 0 }, notice: undefined, stopped: false });
    focusOn('status');
    try {
      let result = await door(namespace, 'apply', body);
      update({ job: result.job });
      // The band names the approval while the job moves; a finished job reads it as it settles.
      if (!session.approval && moving(result.job.state)) update({ approval: (await door(namespace, 'status', { planId })).approval });
      if (moving(result.job.state) && alive.current) result = await repeat(() => door(namespace, 'apply', body), job => update({ job }), go);
      if (alive.current) await settle(namespace, planId, result.job);
    } catch (error) {
      if (!failed(error)) refuse(error);
      else try { await settle(namespace, planId, (await door(namespace, 'status', { planId })).job); } catch (inner) { refuse(inner); }
    }
    // History shows each attempt as the door now holds it, whether it finished or was refused.
    if (alive.current) await load();
  });
  /** Undo a completed import, or roll back what a failed apply wrote: the door's one undo step. */
  const reverse = (step: 'undoing' | 'rolling_back') => once(async () => {
    const { namespace, planId } = session;
    if (!namespace || !planId) return;
    update({ step, notice: undefined, stopped: false });
    focusOn('status');
    try {
      const result = await repeat(() => door(namespace, 'undo', { planId }), job => update({ job }), go);
      if (alive.current && result.job) await settle(namespace, planId, result.job);
    } catch (error) {
      if (!(error instanceof DoorRefusal && ['native_edit_conflict', 'import_superseded'].includes(error.code))) refuse(error);
      else try { const facts = await door(namespace, 'status', { planId }); update({ job: facts.job, undo: facts.undo }); refuse(error, step === 'undoing' ? 'imported' : 'failed'); } catch (inner) { refuse(inner); }
    }
    if (alive.current) await load();
  });
  const undoRow = (row: HistoryRow) => once(async () => {
    setHistoryUndo({ planId: row.planId });
    focusOn('status');
    try {
      const result = await repeat(() => undoFromHistory(row.planId), job => { if (alive.current) setHistoryUndo({ planId: row.planId, job }); }, go);
      if (!alive.current) return;
      setHistoryUndo(null);
      if (result.job?.state === 'undone' && (session.planId === row.planId || session.step === 'empty' || session.step === 'undone')) replace({ step: 'undone', row, job: result.job });
      refresh();
    } catch (error) { setHistoryUndo(null); refuse(error); }
    await load();
  })();
  const settings = (change: { enabled: boolean; revokedKids?: string[] }) => once(async () => {
    try { const value = await writeImports(change); if (alive.current) setImports(value); } catch (error) { refuse(error); }
  })();

  return { session, imports, unavailable, ready, historyUndo, actions: { choose, start, discard, apply, undo: reverse('undoing'), rollBack: reverse('rolling_back'), undoRow, settings } };
}
