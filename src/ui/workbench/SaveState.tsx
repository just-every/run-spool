import type { useSaveState } from './useAutoPreview';

export function SaveState({ state }: { state: ReturnType<typeof useSaveState>['state'] }) {
  if (state.phase === 'idle') return null;
  if (state.phase === 'failed') return <p role="alert" className="save-failed">Not saved: {state.message} <button type="button" className="text-button" onClick={state.retry}>Retry</button></p>;
  return <span role="status" className="meta save-state">{state.phase === 'saving' ? 'Saving…' : 'Saved'}</span>;
}
