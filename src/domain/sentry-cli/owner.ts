import { readBuildSet } from '../source-map-builds';
import { ownerProjectRouter } from '../owner-router';

/** The owner's view of what unmodified CLI and plugin uploads stored and why a bundle was refused. Read-only:
 * no map content leaves here, and neither deploy nor agent keys reach it. */
export const sentryUploadRoutes = ownerProjectRouter();
sentryUploadRoutes.get('/', async c => {
 const project = c.req.param('project')!, db = c.env.DB;
 const [artifacts, assemblies] = await Promise.all([
  db.prepare('SELECT release,build,debug,digest,length(CAST(payload AS BLOB)) bytes,created FROM artifacts WHERE project=? ORDER BY created DESC,release,build,debug').bind(project).all(),
  db.prepare("SELECT checksum,state,detail,created FROM sentry_assemblies WHERE project=? ORDER BY created DESC,checksum LIMIT 50").bind(project).all(),
 ]);
 const sets=(await db.prepare('SELECT release,build FROM source_map_builds WHERE project=? ORDER BY created DESC LIMIT 100').bind(project).all<{release:string;build:string}>()).results;
 return c.json({ artifacts: artifacts.results, assemblies: assemblies.results,builds:await Promise.all(sets.map(row=>readBuildSet(db,project,row.release,row.build))) });
});
