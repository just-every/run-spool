import type { View } from './location';
export function navigationDestinations(billing = false, manageProject = true): [View, string][] {
  return billing ? [['settings', 'Settings']] : [['issues', 'Issues'], ['releases', 'Releases'], ['reports', 'Reports'], ['capture', 'Capture'], ...(manageProject ? [['alerts', 'Alerts'] as [View, string]] : []), ['settings', 'Settings']];
}
