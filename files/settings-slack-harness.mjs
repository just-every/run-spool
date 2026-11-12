import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {receiver} from '/workspace/run-spool/tests/alerts/receiver.mjs';
import {slackUI} from '/workspace/run-spool/tests/slack-ui.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
const temporary=await mkdtemp(join(tmpdir(),'spool-settings-slack-'));
let inbox,browser;
try{inbox=await receiver(join(temporary,'receiver.sqlite'));browser=await launchBrowser();await slackUI(browser,inbox);}finally{await browser?.close();await inbox?.close();await rm(temporary,{recursive:true,force:true});}
