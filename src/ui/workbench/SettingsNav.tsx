import { useEffect, useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Icon } from './icons';
import { settingsHref } from './location';
import type { SettingsSection } from './settingsSections';

/** The section list left of the content; at phone width one control under the title that names the section. */
export function SettingsNav({ project, sections, current }: { project: string; sections: SettingsSection[]; current: SettingsSection }) {
  const [open, setOpen] = useState(false), list = useId();
  useEffect(() => setOpen(false), [current.id]);
  const groups = (['Project', 'Organization'] as const).map(group => [group, sections.filter(section => section.group === group)] as const).filter(([, items]) => items.length);
  return <nav className="settings-nav" aria-label="Settings sections">
    <button type="button" className="settings-toggle outline-button" aria-expanded={open} aria-controls={list} onClick={() => setOpen(value => !value)}><span className="label">Section</span><span className="settings-current">{current.title}</span><Icon name="down" /></button>
    <div id={list} className={`settings-list${open ? ' open' : ''}`}>
      {groups.map(([group, items]) => <div key={group} className="settings-group" role="group" aria-labelledby={`${list}-${group}`}>
        <span id={`${list}-${group}`} className="label">{group}</span>
        <ul>{items.map(section => <li key={section.id}><Link to={(project ? settingsHref(project, section.id) : '/') as any} aria-current={section.id === current.id ? 'page' : undefined}>{section.title}</Link></li>)}</ul>
      </div>)}
    </div>
  </nav>;
}
