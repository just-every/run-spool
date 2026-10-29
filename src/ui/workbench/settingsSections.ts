// Settings, one path per section, in two groups. Each section shows only for the roles that see one of its parts;
// the parts keep their own role checks inside the section.
export type SettingsRoles = { project: boolean; configure: boolean; manager: boolean; owner: boolean };
export type SettingsSection = { id: string; group: 'Project' | 'Organization'; title: string; visible: (roles: SettingsRoles) => boolean };
export const settingsSections: SettingsSection[] = [
  { id: 'keys-and-capture', group: 'Project', title: 'Keys and capture', visible: roles => roles.project },
  { id: 'grouping', group: 'Project', title: 'Grouping', visible: roles => roles.project && roles.configure },
  { id: 'releases-and-commits', group: 'Project', title: 'Releases and commits', visible: roles => roles.project && roles.configure },
  { id: 'users-and-feedback', group: 'Project', title: 'Users and feedback', visible: roles => roles.project && (roles.configure || roles.manager) },
  { id: 'alerts', group: 'Project', title: 'Alerts', visible: roles => (roles.project && roles.configure) || roles.owner },
  { id: 'reports', group: 'Project', title: 'Reports', visible: roles => roles.project && roles.configure },
  { id: 'data', group: 'Project', title: 'Data', visible: roles => roles.project && (roles.configure || roles.owner) },
  { id: 'members', group: 'Organization', title: 'Members', visible: () => true },
  { id: 'audit', group: 'Organization', title: 'Audit', visible: roles => roles.manager },
  { id: 'imports-and-archive', group: 'Organization', title: 'Imports and archive', visible: roles => roles.owner },
];
export const settingsTitle = (id?: string) => settingsSections.find(section => section.id === id)?.title;
