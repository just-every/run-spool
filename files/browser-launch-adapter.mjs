import {createRequire} from 'node:module';
const require = createRequire('/workspace/run-spool/package.json');
const {chromium} = require('@playwright/test');
const launch = chromium.launch.bind(chromium);
chromium.launch = (options = {}) => launch({...options, executablePath: '/usr/bin/chromium', args: [...(options.args ?? []), '--no-sandbox']});
