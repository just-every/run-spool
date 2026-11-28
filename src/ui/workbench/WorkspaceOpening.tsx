import { Wordmark } from '../Wordmark';

export function WorkspaceOpening({ failure, retry }: { failure?: string; retry?: () => void }) {
  return <main className="login">
    <Wordmark />
    <section className="login-panel card">
      <h1>{failure ? 'Your workspace is unavailable' : 'Opening your workspace'}</h1>
      <p role={failure ? 'alert' : 'status'}>{failure || 'Checking your session…'}</p>
      {failure && <button className="primary-button" onClick={retry}>Try again</button>}
    </section>
  </main>;
}
