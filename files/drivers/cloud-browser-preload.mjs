// Cloud-only launch configuration for suites that call Playwright directly.
import {chromium} from '/workspace/run-spool/node_modules/@playwright/test/index.mjs';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,executablePath:'/usr/bin/chromium',args:[...(options?.args??[]),'--no-sandbox']});
