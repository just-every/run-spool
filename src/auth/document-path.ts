/** Product document routes, shared by the Worker and the local Vite boundary. */
export function applicationDocument(path: string): boolean {
 if (['/', '/app', '/setup', '/sign-in', '/signin'].includes(path)) return true;
 return /^\/projects\/[^/]+\/(?:issues(?:\/[^/]+)?|releases|capture|settings|alerts)\/?$/.test(path);
}
export function servicePath(path: string): boolean {
 return path === '/setup/state' || path === '/health' || path === '/api' || path.startsWith('/api/') || path.startsWith('/auth/') || path.startsWith('/__dev/');
}
