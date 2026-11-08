#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { sentryImportCli } from './sentry-import.mjs';

/** Spool's owner-session Bugsnag importer: the same import door, lineage, review
 * fingerprint, resume and guarded undo as the Sentry importer, for one Bugsnag
 * organization export (`spool-bugsnag-org-export`). */
export const bugsnagImportCli = args => sentryImportCli(args, 'bugsnag');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) bugsnagImportCli(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
