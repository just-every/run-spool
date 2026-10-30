import { settingsSections } from '../ui/workbench/settingsSections';

// Settings has one path per section; an unknown section is not a product document.
const documentRoute = new RegExp(String.raw`^\/projects(?:\/[^/]+(?:\/(?:issues(?:\/[^/]+)?|releases(?:\/[^/]+|\/setup\/source-maps)?|capture|settings(?:\/(?:${settingsSections.map(section => section.id).join('|')}))?|alerts|reports))?)?\/?$`);

/** Product document routes, shared by the Worker and the local Vite boundary. */
export function applicationDocument(path: string): boolean {
 if (['/', '/app', '/setup', '/sign-in', '/signin'].includes(path)) return true;
 return documentRoute.test(path);
}
export function servicePath(path: string): boolean {
 return path === '/setup/state' || path === '/health' || path === '/api' || path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/__dev/');
}
