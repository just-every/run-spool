import type { ReactNode } from 'react';
import './move-in.css';
import type { OrganizationRole } from './Members';
import { BusinessImports, History } from './BusinessImports';
import { MoveInFile, type FileAction } from './MoveInFile';
import { MoveInChanges, MoveInResult } from './MoveInPlan';
import { ApplyBand, JobBand, UndoBand } from './MoveInBand';
import { baseline, caption, historyName, plural, status, undoReach, words, type Session } from './move-in-model';
import { useMoveIn } from './useMoveIn';

/** The shell's header for Move in; the workbench's own notice (a failed sign-out, say) shows under it. */
function Hero({ line, notice, children }: { line: string; notice: string; children?: ReactNode }) {
  return <header className="hero move-in-hero"><div className="crumb">Your installation / Move in</div><h1>{words.title}</h1><p className="description">{line}</p>
    {children}{notice && <p role="alert" className="callout status-notice move-in-notice">{notice}</p>}
  </header>;
}

/** Move in (`/move-in`): the owner brings Sentry history in from an export file,
 * reviews an exact dry run, applies exactly that plan, sees Spool's own check and
 * can undo it. The owner gate is decided from `access.role` before any import
 * call: a non-owner's 401 there would sign the whole workbench out. */
export function MoveIn({ role, projects, notice, refresh }: { role?: OrganizationRole; projects: { id: string; name: string }[]; notice: string; refresh: () => void }) {
  return role === 'owner' ? <OwnerMoveIn projects={projects} notice={notice} refresh={refresh} /> : <Hero line={words.notOwner} notice={notice} />;
}

/** This file's control in each state; undefined when the section has nothing to show. */
function fileAction(session: Session): FileAction | undefined {
  const held = !!session.facts;
  switch (session.step) {
    case 'empty': case 'undone': return 'choose';
    case 'chosen': return 'start';
    case 'review': case 'imported': return held ? 'another' : undefined;
    case 'refused': return session.notice?.action ?? 'another';
    case 'changed': return 'replan';
    case 'failed': return held ? session.job?.checkpoint ? null : 'newRun' : undefined;
    case 'rolled_back': return held ? 'newRun' : 'choose';
    default: return held ? null : undefined;
  }
}

function OwnerMoveIn({ projects, notice: workspaceNotice, refresh }: { projects: { id: string; name: string }[]; notice: string; refresh: () => void }) {
  const { session, imports, unavailable, ready, historyUndo, actions } = useMoveIn(refresh);
  if (unavailable) return <Hero line={words.unavailable} notice={workspaceNotice} />;
  const notice = !historyUndo && session.notice;
  const progress = historyUndo ? historyUndo.job ? status({ step: 'undoing', job: historyUndo.job }) : { chip: 'Undo in progress', line: '' } : notice ? null : status(session);
  const compared = session.plan || session.job ? session.baseline : session.namespace && imports ? baseline(imports.history, session.namespace) : undefined;
  const action = fileAction(session), cp = session.job?.checkpoint ?? 0;
  const who = session.row ? <><p><strong>{historyName(session.row)}</strong></p><p>{caption(session.row, session.row.approvedAt)}</p></>
    : session.approval ? <p>{caption(session.approval, session.approval.approved_at)}</p> : null;
  const rollBack = { label: 'Roll back what was written', consequence: `Removes the ${plural(cp, 'record')} this attempt wrote.`, onClick: actions.rollBack };
  const labels = session.plan?.reasonLabels ?? session.reconcile?.reasonLabels ?? imports?.reasonLabels ?? {};
  const shown = ready || session.step !== 'empty';
  return <div className="move-in">
    <Hero line={words.description} notice={workspaceNotice}>
      <p id="move-in-status" className="move-in-status" role="status" tabIndex={-1}>{progress && <><span className="state-chip">{progress.chip}</span>{progress.line && <span>{progress.line}</span>}</>}</p>
      {notice && <div id="move-in-notice" className="callout status-notice move-in-notice" role="alert" tabIndex={-1}>
        <strong>{notice.title}</strong>{notice.text && <p>{notice.text}</p>}{notice.technical && <p className="muted">Technical details: {notice.technical}</p>}
      </div>}
    </Hero>
    {shown && action !== undefined && <MoveInFile session={session} compared={compared} action={action} onFile={actions.choose} onStart={actions.start} onReplan={actions.start} />}
    {session.plan && ['review', 'applying'].includes(session.step) && <MoveInChanges plan={session.plan} catchup={!!session.baseline} facts={session.facts} />}
    {session.step === 'imported' && session.reconcile && <MoveInResult report={session.reconcile} plan={session.plan} projects={projects} facts={session.facts}
      rejected={session.plan?.rejected ?? imports?.history.find(row => row.planId === session.planId)?.rejected ?? []} />}
    {session.step === 'review' && session.plan && <ApplyBand plan={session.plan} onApply={actions.apply} onDiscard={actions.discard} />}
    {session.step === 'applying' && <JobBand title="Apply" action={session.stopped ? { label: 'Continue applying', consequence: words.continueApply, onClick: actions.apply } : undefined}>
      {who}{!session.stopped && <p className="muted">{words.writing}</p>}
    </JobBand>}
    {(session.step === 'failed' && cp > 0 || session.step === 'rolling_back') && <JobBand title="Roll back" action={session.step === 'failed' || session.stopped ? rollBack : undefined}>{who}</JobBand>}
    {session.step === 'imported' && <UndoBand reach={session.reconcile && undoReach(session.reconcile.counts.byKind)} undo={session.undo} labels={labels} onUndo={actions.undo} />}
    {session.step === 'undoing' && (session.stopped && session.undo && !session.undo.available
      ? <UndoBand undo={session.undo} labels={labels} onUndo={actions.undo} />
      : <JobBand title="Undo" action={session.stopped ? { label: 'Continue undo', consequence: words.continueUndo, onClick: actions.undo } : undefined}>
        {session.reconcile ? <p>{undoReach(session.reconcile.counts.byKind)}</p> : who}
      </JobBand>)}
    {imports && <History imports={imports} held={session.held} onUndo={actions.undoRow} />}
    {imports && <BusinessImports imports={imports} onSettings={actions.settings} />}
  </div>;
}
