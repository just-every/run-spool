import {writeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';

const runtimeURL = new URL('./runtime.mjs', import.meta.url).href;
const runtimePath = fileURLToPath(runtimeURL);
const nativeStackGetter = Object.getOwnPropertyDescriptor(new Error(), 'stack')?.get;
const errorTypes = new Set(['Error', 'AssertionError', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'AggregateError']);
const errorCodes = new Set(['ERR_ASSERTION', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'ABORT_ERR']);

function ownValue(error, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}

function metadata(value) {
  const type = value === null ? 'null' : typeof value;
  return {type, ...(type === 'boolean' ? {boolean: value} : {}),
    ...(Number.isInteger(value) && value >= 100 && value <= 599 ? {numeric_status: value} : {})};
}

function errorType(error) {
  try {
    let current = error;
    for (let depth = 0; current && depth < 5; depth++, current = Object.getPrototypeOf(current)) {
      const name = ownValue(current, 'name');
      if (typeof name === 'string' && errorTypes.has(name)) return name;
    }
  } catch {}
  return 'unknown';
}

function coordinates(line, column) {
  return Number.isInteger(line) && line > 0 && line <= 10000 &&
    Number.isInteger(column) && column > 0 && column <= 100000 ? {line, column} : {};
}

function stringFrame(stack) {
  if (typeof stack !== 'string' || stack.length > 32768) return {};
  // Match only a complete frame for this known source; never emit stack paths.
  for (const frame of stack.split('\n').slice(0, 100)) {
    const match = /^\s+at (?:[^\r\n]* \()?(.+):(\d{1,5}):(\d{1,6})\)?$/.exec(frame);
    if (match && (match[1] === runtimeURL || match[1] === runtimePath)) return coordinates(Number(match[2]), Number(match[3]));
  }
  return {};
}

function sourceFrame(error) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'stack');
    if (descriptor && Object.hasOwn(descriptor, 'value')) {
      return stringFrame(descriptor.value);
    }
    // Recent Node versions expose lazy stacks via a shared native getter. Never
    // invoke an error's custom getter or the default formatter (which reads text).
    if (!nativeStackGetter || descriptor?.get !== nativeStackGetter) return {};
    const previous = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
    try {
      Object.defineProperty(Error, 'prepareStackTrace', {configurable: true, value: (_error, frames) => {
        for (const frame of frames.slice(0, 100)) {
          const file = frame.getFileName();
          if (file === runtimeURL || file === runtimePath) return coordinates(frame.getLineNumber(), frame.getColumnNumber());
        }
        return {};
      }});
      const frame = Reflect.apply(nativeStackGetter, error, []);
      return typeof frame === 'string' ? stringFrame(frame) : coordinates(ownValue(frame, 'line'), ownValue(frame, 'column'));
    } finally {
      if (previous) Object.defineProperty(Error, 'prepareStackTrace', previous);
      else delete Error.prepareStackTrace;
    }
  } catch { return {}; }
}

// Use native accessors so an overridden property/getter cannot run during the
// observation. No request argument, response URL, header value, or body is emitted.
const responseStatus = Object.getOwnPropertyDescriptor(Response.prototype, 'status').get;
const responseHeaders = Object.getOwnPropertyDescriptor(Response.prototype, 'headers').get;
const responseBody = Object.getOwnPropertyDescriptor(Response.prototype, 'body').get;
const cloneResponse = Response.prototype.clone;
const getHeader = Headers.prototype.get;
// Only HTTP 500 delivery is delayed: at most 16 KiB is copied/classified and
// reads have a shared 1 s cooperative deadline. Scheduling, synchronous cloning,
// and stderr writes are outside that deadline. Fetch/tee may buffer larger
// underlying chunks; cancelling the clone cannot abort the original transport.
const byteLimit = 16 * 1024, deadlineMs = 1000;

async function observe500(response) {
  let reader, timer, complete = false;
  const record = {spool_runtime_diagnostic: 'http_500_response', status: 500,
    contentType: 'unknown', bodyState: 'unavailable', networkConnectionLost: false,
    honoInternalServerError: false, workerdScriptNoResponse: false, refusalCode: 'unknown'};
  try {
    const header = Reflect.apply(getHeader, Reflect.apply(responseHeaders, response, []), ['content-type']);
    const mime = typeof header === 'string' && header.length <= 256 ? header.split(';', 1)[0].trim().toLowerCase() : '';
    record.contentType = mime === 'application/json' ? 'json' : mime === 'text/plain' ? 'text' : mime === 'text/html' ? 'html' : header === null ? 'absent' : 'other';
    const clone = Reflect.apply(cloneResponse, response, []);
    const stream = Reflect.apply(responseBody, clone, []);
    const bytes = new Uint8Array(byteLimit);
    let size = 0;
    if (stream) {
      reader = stream.getReader();
      const timedOut = Symbol();
      const deadline = new Promise(resolve => { timer = setTimeout(() => resolve(timedOut), deadlineMs); });
      const expires = performance.now() + deadlineMs;
      record.bodyState = 'capped';
      while (size < byteLimit) {
        // Check time between immediately resolved chunks too; a stream must not
        // starve the deadline timer with a chain of fulfilled read promises.
        if (performance.now() >= expires) { record.bodyState = 'timeout'; break; }
        const chunk = await Promise.race([reader.read(), deadline]);
        if (chunk === timedOut) { record.bodyState = 'timeout'; break; }
        if (chunk.done) { complete = true; record.bodyState = 'complete'; break; }
        const count = Math.min(chunk.value.byteLength, byteLimit - size);
        bytes.set(chunk.value.subarray(0, count), size); size += count;
      }
    } else { complete = true; record.bodyState = 'complete'; }
    const text = new TextDecoder().decode(bytes.subarray(0, size));
    // These are text signatures, not claims about which layer generated them.
    record.networkConnectionLost = text.includes('Network connection lost');
    record.honoInternalServerError = text.trim() === 'Internal Server Error';
    record.workerdScriptNoResponse = text.includes('The script will never generate a response');
    if (complete && record.contentType === 'json') {
      try {
        const code = ownValue(JSON.parse(text), 'error');
        record.refusalCode = code === 'Same-origin required' ? 'same_origin_required' : code === 'Invalid project' ? 'invalid_project' : code === 'Sign in required' ? 'sign_in_required' : 'unknown';
      } catch {}
    }
  } catch { record.bodyState = 'unavailable'; }
  finally {
    clearTimeout(timer);
    // A clone's cancellation can wait for the original tee branch. Never await
    // it or cancel the original; observe rejection and release the clone lock.
    if (reader) {
      if (!complete) try { void reader.cancel().catch(() => {}); } catch {}
      try { reader.releaseLock(); } catch {}
    }
  }
  try { writeSync(2, JSON.stringify(record) + '\n'); } catch {}
}

export function observeRuntimeFetch() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const original = ownValue(globalThis, 'fetch');
  if (typeof original !== 'function') return () => {};
  function observedFetch(...args) {
    // Preserve receiver, arguments, response identity, and original rejection.
    return Reflect.apply(original, this, args).then(async response => {
      try {
        if (!types.isProxy(response) && Reflect.apply(responseStatus, response, []) === 500) await observe500(response);
      } catch {}
      return response;
    });
  }
  try { Object.defineProperty(globalThis, 'fetch', {...previous, value: observedFetch}); }
  catch { return () => {}; }
  return () => { Object.defineProperty(globalThis, 'fetch', previous); };
}

function workerRecord(worker) {
  const record = {redacted: true};
  for (const key of ['networkConnectionLost', 'd1Error', 'sqliteError']) record[key] = ownValue(worker, key) === true;
  const lines = ownValue(worker, 'lines');
  if (Number.isSafeInteger(lines) && lines >= 0) record.lines = lines;
  const mentions = ownValue(worker, 'mentions');
  record.mentions = {};
  for (const key of ['typeError', 'referenceError', 'rangeError', 'syntaxError', 'invalidProject', 'instanceofOperand', 'temporalDeadZone', 'undefinedAccess', 'notDefined', 'internalError', 'scriptNoResponse', 'contextNotFinalized', 'scrub', 'apiErrorHandler']) {
    record.mentions[key] = ownValue(mentions, key) === true;
  }
  return record;
}

export function emitRuntimeDiagnostic(error, workerBeforeStop, workerAfterStop) {
  // Inspection and stderr failure must never replace the journey's fixed error.
  try {
    const code = ownValue(error, 'code');
    const type = errorType(error);
    const record = {spool_runtime_diagnostic: 'owner_runtime_failure',
      assertionError: type === 'AssertionError' || code === 'ERR_ASSERTION',
      error_type: type, error_code: typeof code === 'string' && errorCodes.has(code) ? code : 'unknown',
      source: sourceFrame(error), actual: metadata(ownValue(error, 'actual')), expected: metadata(ownValue(error, 'expected'))};
    // Rebuild snapshots using fixed keys; never serialize the caller's object.
    if (workerBeforeStop) record.workerBeforeStop = workerRecord(workerBeforeStop);
    if (workerAfterStop) record.workerAfterStop = workerRecord(workerAfterStop);
    writeSync(2, JSON.stringify(record) + '\n');
  } catch {}
}
