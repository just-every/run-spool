import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { blockerWords, kindName, plural, words, type Labels, type Plan, type Undo } from './move-in-model';

/** A band: what it does at the left, its controls at the right, with a hairline between (stacked below 901 px). */
function Band({ title, children, side }: { title: string; children: ReactNode; side?: ReactNode }) {
  const id = useId();
  return <section className="evidence move-in-band" aria-labelledby={id}><h2 id={id}>{title}</h2>
    <div className={side ? 'move-in-band-grid' : undefined}><div>{children}</div>{side && <div className="move-in-band-side">{side}</div>}</div>
  </section>;
}

/** The only control that writes, beside the labelled fingerprint of exactly the plan above it. */
export function ApplyBand({ plan, onApply, onDiscard }: { plan: Plan; onApply: () => void; onDiscard: () => void }) {
  return <Band title="Apply" side={<>
    <button className="primary-button" onClick={onApply}>Apply this plan</button>
    <p className="muted move-in-consequence">Writes {plural(plan.counts.effects, 'record')} into Spool: exactly this plan. You can undo it while nobody has edited them.</p>
    <button className="text-button" onClick={onDiscard}>Discard dry run</button>
  </>}>
    <p className="move-in-label">Fingerprint of this plan</p>
    <pre className="move-in-fingerprint">{plan.fingerprint}</pre>
    <p>{words.fingerprint}</p>
  </Band>;
}

type BandAction = { label: string; consequence: string; onClick: () => void };
/** A job that is moving or stopped: what it is, and Continue or Roll back when it stopped. */
export function JobBand({ title, children, action }: { title: string; children: ReactNode; action?: BandAction }) {
  return <Band title={title} side={action && <><button className="primary-button" onClick={action.onClick}>{action.label}</button><p className="muted move-in-consequence">{action.consequence}</p></>}>{children}</Band>;
}

/** An inline confirm in place of the control that opened it; closing returns focus there. */
export function Confirm({ opener: label, openerClass = 'text-button', detail, question, confirm, keep, onConfirm }: {
  opener: string; openerClass?: string; detail?: ReactNode; question: string; confirm: string; keep: string; onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false), opener = useRef<HTMLButtonElement>(null), group = useRef<HTMLDivElement>(null), was = useRef(false);
  useEffect(() => { if (open) group.current?.focus(); else if (was.current) opener.current?.focus(); was.current = open; }, [open]);
  return open ? <div className="move-in-confirm" role="group" aria-label={question} tabIndex={-1} ref={group}>
    {detail}<p>{question}</p>
    <div className="move-in-confirm-actions"><button className="danger-button" onClick={onConfirm}>{confirm}</button><button className="text-button" onClick={() => setOpen(false)}>{keep}</button></div>
  </div> : <button ref={opener} className={openerClass} onClick={() => setOpen(true)}>{label}</button>;
}

/** Undo: what it reverses, or why it isn't available and which records hold it. */
export function UndoBand({ reach, undo, labels, onUndo }: { reach?: string; undo?: Undo; labels: Labels; onUndo: () => void }) {
  const [all, setAll] = useState(false);
  if (undo && !undo.available && undo.blockers.length) {
    const reasons = [...new Set(undo.blockers.map(row => row.reasonCode))], shown = all ? undo.blockers : undo.blockers.slice(0, 3);
    return <Band title="Undo">
      <p className="move-in-strong">{words.undoUnavailable}</p>
      {reasons.map(code => <p key={code}>{blockerWords[code]?.[0] ?? labels[code]}</p>)}
      <div className="table-region move-in-rows">
        {shown.map((row, index) => <div className="move-in-row move-in-blocker" key={index}>
          <span><strong>{kindName(row.kind)}</strong> · {row.label ?? labels[row.labelReasonCode ?? 'record_label_unavailable']}</span>
          <span className="muted">{blockerWords[row.reasonCode]?.[1]}</span>
        </div>)}
        {undo.blockers.length > 3 && !all && <div className="move-in-row"><button className="text-button" onClick={() => setAll(true)}>Show all {undo.blockers.length}</button></div>}
      </div>
      {reasons.includes('native_edit_conflict') && <p>{words.keepOrErase}</p>}
    </Band>;
  }
  return <Band title="Undo" side={<Confirm opener="Undo this import" openerClass="danger-button" question={words.confirmUndo} confirm="Undo this import" keep="Keep the import" onConfirm={onUndo} />}>{reach && <p>{reach}</p>}</Band>;
}
