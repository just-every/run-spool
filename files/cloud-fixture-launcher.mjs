// Cloud launcher only: preserve the repository's entire SDK journey unchanged.
import {chromium} from '/workspace/run-spool/node_modules/@playwright/test/index.mjs';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,executablePath:'/usr/bin/chromium',args:[...(options?.args??[]),'--no-sandbox']});
await import('/workspace/run-spool/tests/sentry-sdk.mjs');
