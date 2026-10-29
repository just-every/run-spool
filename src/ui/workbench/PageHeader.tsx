import type { ReactNode } from 'react';

/** Breadcrumb line, the one ink page rule under it, then the page or record title. Nothing else sits above the title. */
export function PageHeader({ crumb, title, record = false, children }: { crumb: ReactNode; title: ReactNode; record?: boolean; children?: ReactNode }) {
  return <header className="page-head">
    <div className="crumb">{crumb}</div>
    <h1 className={record ? 'record-title' : 'page-title'} title={record && typeof title === 'string' ? title : undefined}>{title}</h1>
    {children}
  </header>;
}
