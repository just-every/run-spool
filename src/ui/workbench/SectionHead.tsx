import type { ReactNode } from 'react';
import { Details } from './Details';

/** A section's title on the section-title step, the reference text folded behind one info control beside it, and
 * the section's own actions at the end of the same line. */
export function SectionHead({ title, about, id, children }: { title: string; about?: ReactNode; id?: string; children?: ReactNode }) {
  return <div className="section-head">
    <h2 id={id}>{title}</h2>
    {about && <Details icon="info" title={title}>{about}</Details>}
    {children && <div className="section-actions">{children}</div>}
  </div>;
}
