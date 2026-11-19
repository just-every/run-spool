import { appJwt, type Connection } from './connection';
import { FIX_PERMISSIONS } from './grant';

// This App-authenticated read neither mints an installation token nor enters a fix workflow.
export async function testConnection(link: Extract<Connection, {state:'configured'}>) {
 let jwt: string;
 try { jwt = await appJwt(link); } catch { throw new Error('The saved private key cannot sign a GitHub App request. Replace the key and try again.'); }
 let response: Response;
 try {
  response = await fetch(link.apiOrigin + '/app/installations/' + link.installationId, {
   method:'GET', redirect:'manual', signal:AbortSignal.timeout(12_000),
   headers:{Authorization:'Bearer ' + jwt, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'spool-connection-test'},
  });
 } catch { throw new Error('Spool could not reach GitHub. Try the connection test again.'); }
 if (!response.ok) {
  await response.body?.cancel();
  if (response.status === 401) throw new Error('GitHub rejected the App credentials. Check the App ID and its private key.');
  if (response.status === 404) throw new Error('GitHub could not find this installation for the App. Check the installation ID.');
  throw new Error(`GitHub refused the installation check (HTTP ${response.status}).`);
 }
 const installation: any = await response.json().catch(() => null);
 if (String(installation?.id) !== link.installationId || String(installation?.app_id) !== link.appId) throw new Error('GitHub did not confirm the selected App and installation IDs.');
 if (installation.suspended_at) throw new Error('The GitHub App installation is suspended. Resume it in GitHub before testing again.');
 const labels:Record<string,string> = {contents:'Contents',pull_requests:'Pull requests',checks:'Checks'};
 for (const [name,required] of Object.entries(FIX_PERMISSIONS)) {
  const permission = installation.permissions?.[name];
  if (permission !== required && !(required === 'read' && permission === 'write')) throw new Error(`Grant ${labels[name]} ${required} access to this GitHub installation and test again.`);
 }
 return {ok:true, appId:link.appId, installationId:link.installationId};
}
