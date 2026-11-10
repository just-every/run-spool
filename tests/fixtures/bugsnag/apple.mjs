import { bugsnagFixture } from './organization.mjs';
import { syntheticUuid } from './native-files.mjs';

/** A Data Access v2 export with one iOS crash whose native frames carry only a Mach-O UUID and addresses. */
export function bugsnagAppleFixture() {
 const bundle = bugsnagFixture(), time = '2026-06-01T12:00:00Z';
 const rows = (kind, project) => bundle.collections.find(c => c.kind === kind && c.project === project).pages[0].response;
 bundle.organization = { ...bundle.organization, id: 'synthetic-spool-apple' };
 const ios = { ...structuredClone(rows('projects', null)[1]), id: 'ios', name: 'Cedar iOS shop', type: 'ios', organization_id: 'synthetic-spool-apple' };
 bundle.collections = bundle.collections.filter(c => c.kind === 'projects');
 bundle.collections[0].pages[0].response = [ios];
 const release = { id: 'ios-release', project_id: 'ios', app_version: '1.0.0', app_bundle_version: '84', release_stage: { name: 'production' }, release_time: time };
 const error = { id: 'ios-error', project_id: 'ios', error_class: 'EXC_BAD_ACCESS', message: 'Checkout crash', status: 'open', first_seen: time, last_seen: time };
 const frame = { macho_uuid: syntheticUuid.toUpperCase(), frame_address: '0x100003f50', symbol_address: '0x100003f40', load_address: '0x100000000', code_file: '/private/var/containers/Bundle/Application/SyntheticApp', in_project: true };
 const event = { id: 'ios-event', error_id: 'ios-error', project_id: 'ios', received_at: time, severity: 'error', unhandled: true,
  app: { version: '1.0.0', releaseStage: 'production', type: 'ios', bundleVersion: '84' },
  exceptions: [{ error_class: 'EXC_BAD_ACCESS', message: 'Checkout crash', stacktrace: [frame, { ...frame, frame_address: '0x100003f10', symbol_address: '0x100003f00' }] }], breadcrumbs: [] };
 for (const [kind, response] of [['releases', [release]], ['errors', [error]], ['events', [event]]]) bundle.collections.push({ kind, project: 'ios', pages: [{ cursor: null, nextCursor: null, response }] });
 return bundle;
}
