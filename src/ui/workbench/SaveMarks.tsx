import type { useSettingDoc } from './useSettingDoc';
import './autosave.css';

type Doc = Pick<ReturnType<typeof useSettingDoc<any, any>>, 'status' | 'retry'>;

/** A quiet "Saved" beside the field it saved. It always holds its space, so nothing moves; the word is drawn by CSS, so it never joins a field's name. */
export function SavedMark({ doc, field = '' }: { doc: Doc; field?: string }) {
  const shown = doc.status.phase === 'saved' && doc.status.field === field;
  return <span className="save-mark" aria-hidden="true" data-state={shown ? 'saved' : 'idle'} />;
}
/** The same word for screen readers, once per section. */
export function SaveAnnouncer({ doc }: { doc: Doc }) {
  return <span className="visually-hidden" role="status">{doc.status.phase === 'saved' ? 'Saved' : ''}</span>;
}
/** A refused save: the reason on one plain line, in view, with Retry sending the same value again. */
export function SaveFailure({ doc, field = '' }: { doc: Doc; field?: string }) {
  if (doc.status.phase !== 'failed' || doc.status.field !== field) return null;
  return <p className="save-failure" role="alert">Not saved. {doc.status.reason} <button type="button" className="text-button" onClick={doc.retry}>Retry</button></p>;
}
