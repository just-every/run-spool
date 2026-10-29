import { Icon } from './icons';

/** The steps the event carried before it broke, as outlined steps joined by arrows. Absent when it carried none. */
export function Breadcrumbs({ steps }: { steps: string[] }) {
  return <section className="evidence breadcrumbs-section" aria-labelledby="breadcrumbs-title">
    <h2 id="breadcrumbs-title">Breadcrumbs</h2>
    <ol className="breadcrumb-steps">{steps.map((step, index) => <li key={index}>{index > 0 && <Icon name="arrow" />}<span className="breadcrumb-step">{step}</span></li>)}</ol>
  </section>;
}
