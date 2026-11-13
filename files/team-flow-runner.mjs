// Apply the cloud task's browser policy to legacy direct chromium.launch calls.
import {chromium} from '/workspace/run-spool/node_modules/@playwright/test/index.mjs';
const launch=chromium.launch.bind(chromium);
chromium.launch=options=>launch({...options,executablePath:'/usr/bin/chromium',args:[...(options?.args??[]),'--no-sandbox']});
const {teamFlow}=await import('/workspace/run-spool/tests/team-flow.mjs');
await teamFlow();
