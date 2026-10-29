import { useRef, type ReactNode } from 'react';
import { kinds, plural, size, when, words, type HistoryRow, type Session } from './move-in-model';

/** The file control: a visually hidden file input inside the button's label,
 * so Enter or Space opens the picker and the label shows its focus. */
function FilePicker({ label, primary, onFile }: { label: string; primary?: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <label className={`${primary ? 'primary-button' : 'text-button'} move-in-picker`}>{label}<input ref={input} type="file" className="visually-hidden" accept=".json,application/json" onChange={event => {
    const file = event.currentTarget.files?.[0];
    if (input.current) input.current.value = '';
    if (file) onFile(file);
  }} /></label>;
}

/** The file's own facts (F), the import it is compared with, and its records once planned. */
function Facts({ session, compared }: { session: Session; compared?: HistoryRow }) {
  const facts = session.facts!, byKind = session.plan?.counts.byKind;
  const fact = (term: string, value: ReactNode) => <div><dt>{term}</dt><dd>{value}</dd></div>;
  return <dl className="move-in-facts">
    {fact('File', `${facts.name} · ${size(facts.size)}`)}
    {fact('Sentry organization', [facts.slug, facts.region].filter(Boolean).join(' · '))}
    {(facts.start || facts.end) && fact('Export window', `${when(facts.start)} – ${when(facts.end)}`)}
    {fact('Compared with', compared ? `Your import of ${when(compared.approvedAt)}` : 'Nothing yet: first import of this organization')}
    {byKind && fact('Records in the file', kinds.map(([kind, label]) => plural(byKind[kind] ?? 0, label.toLowerCase().slice(0, -1))).join(' · '))}
  </dl>;
}

export type FileAction = 'choose' | 'start' | 'replan' | 'newRun' | 'chooseAgain' | 'another' | null;
const nextWords: Partial<Record<Exclude<FileAction, null>, [string, string]>> = {
  choose: ['Choose another file', words.nothingUploaded],
  replan: ['Run the dry run again', words.replanConsequence],
  newRun: ['Run a new dry run', words.replanConsequence],
  chooseAgain: ['Choose the file again', words.nothingUploaded],
};

/** This file: the picker with nothing chosen; otherwise the facts, the next
 * step a refusal names, and the section's one primary or secondary control. */
export function MoveInFile({ session, compared, action, onFile, onStart, onReplan }: {
  session: Session; compared?: HistoryRow; action: FileAction; onFile: (file: File) => void; onStart: () => void; onReplan: () => void;
}) {
  if (!session.facts || (action === 'choose' && !session.notice)) return <section className="evidence move-in-file" aria-labelledby="move-in-file">
    <h2 id="move-in-file">This file</h2>
    {session.notice?.next && <p>{session.notice.next}</p>}
    {!session.notice && <p>{words.choose}</p>}
    <FilePicker primary label={session.notice ? 'Choose another file' : 'Choose export file'} onFile={onFile} />
    <p className="muted move-in-consequence">{session.notice ? words.nothingUploaded : words.limits}</p>
  </section>;
  const next = action && nextWords[action];
  // After a refusal the next step comes first at phone width, so its control is in the first screen.
  return <section className={`evidence move-in-file${session.step === 'refused' ? ' move-in-file-refused' : ''}`} aria-labelledby="move-in-file">
    <h2 id="move-in-file">This file</h2>
    <Facts session={session} compared={compared} />
    {session.notice?.next && ['refused', 'changed', 'failed'].includes(session.step) && <p>{session.notice.next}</p>}
    {action === 'start' && <><button className="primary-button" onClick={onStart}>Start dry run</button><p className="muted move-in-consequence">{words.startConsequence}</p><FilePicker label="Choose another file" onFile={onFile} /></>}
    {next && (action === 'choose' || action === 'chooseAgain'
      ? <FilePicker primary label={next[0]} onFile={onFile} />
      : <button className="primary-button" onClick={onReplan}>{next[0]}</button>)}
    {next && <p className="muted move-in-consequence">{next[1]}</p>}
    {action === 'another' && <FilePicker label="Choose another file" onFile={onFile} />}
  </section>;
}
