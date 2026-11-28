const settingsPaths=['/api/rer/business-settings','/rer-business-logo','/rer-business.css'];
const doorPaths=['/api/rer/agent-decisions','/mcp','/api/rer/agent-policy','/agents','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'];

export function agentDoorRoute(path: string) {
 if(settingsPaths.includes(path))return 'settings';
 if(doorPaths.includes(path)||path.startsWith('/agents/'))return 'door';
 return null;
}
