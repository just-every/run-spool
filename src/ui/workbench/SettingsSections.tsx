import { useState, type ReactNode } from 'react';
import './SettingsSections.css';

const sections = [
  ['access', 'People & projects'], ['capture', 'Keys & capture'], ['grouping', 'Grouping & releases'],
  ['privacy', 'Privacy'], ['integrations', 'Integrations & reports'], ['data', 'Data & history']
] as const;
type Section = typeof sections[number][0];

/** Keep drafts mounted when switching sections; share the selected section in the URL. */
export function SettingsSections({ children }: { children: Record<Section, ReactNode> }) {
  const [selected, setSelected] = useState<Section>(() => {
    const requested = typeof location === 'undefined' ? '' : new URL(location.href).searchParams.get('section');
    return sections.find(([id]) => id === requested)?.[0] ?? 'access';
  });
  function choose(id: Section) {
    setSelected(id);
    const url = new URL(location.href); url.searchParams.set('section', id); history.replaceState(history.state, '', url);
  }
  return <div className="settings-sections">
    <div className="settings-tabs" role="tablist" aria-label="Settings sections">{sections.map(([id, label], index) => <button key={id} id={`settings-tab-${id}`} role="tab" type="button" aria-selected={selected === id} aria-controls={`settings-panel-${id}`} tabIndex={selected === id ? 0 : -1} onClick={() => choose(id)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null;
      if (next !== null) { event.preventDefault(); choose(sections[next][0]); document.getElementById(`settings-tab-${sections[next][0]}`)?.focus(); }
    }}>{label}</button>)}</div>
    <label className="form-field settings-section-picker">Settings section<select aria-label="Settings section" value={selected} onChange={event => choose(event.target.value as Section)}>{sections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    {sections.map(([id, label]) => <div key={id} className="settings-section" role="tabpanel" id={`settings-panel-${id}`} aria-label={label} hidden={selected !== id}>{children[id]}</div>)}
  </div>;
}
