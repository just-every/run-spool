# Bounded OTLP/HTTP JSON intake

Send `POST /api/otlp/{project}/v1/logs` with `Content-Type: application/json` and `Authorization: Bearer <project-ingest-key>`. Configure an exporter or Collector's logs endpoint to this complete URL. The router can be mounted under a different prefix. This is a mandatory Spool mapping profile for located logs and JavaScript exceptions, not full OTLP parity. Binary protobuf, gRPC, traces, metrics, profiles and compressed requests (including gzip) are unsupported. An authenticated owner cookie is insufficient.

Admission uses the native project ingest grant, development credential fence, grant revocation, origin allowlist, registered release/build, project rate budget and retained-event cap. Browser OPTIONS accepts only POST with Authorization and Content-Type requested, for an existing project and its allowed origin. Server requests may omit Origin. An allowed browser origin grants no authentication authority.

## Required profile

Use the protobuf JSON lowerCamelCase hierarchy `resourceLogs[].scopeLogs[].logRecords[]`. Each attribute is a KeyValue object, for example `{"key":"spool.event_id","value":{"stringValue":"unique-occurrence-id"}}`.

Each resource must have these string attributes, applying only to its nested records:

| Resource attribute | Native field |
| --- | --- |
| `service.version` | Registered release |
| `spool.build` | That release's registered build |
| `deployment.environment.name` | Environment |

Every record requires string attribute `spool.event_id`, a stable occurrence ID unique within the project. It is mandatory for idempotent retries. Neither traceId nor spanId identifies an occurrence. Native IDs/build/environment/type accept 1–100 ASCII letters, digits, dot, underscore, colon and hyphen; release also accepts at, plus and 1–200 characters.

An exception requires string attributes `exception.type`, `exception.message`, and `exception.stacktrace`. The stack must contain at least one native-parseable JavaScript location: V8 `at function (file:line:column)` or Firefox/Safari `function@file:line:column`. Native stack parsing retains up to 30 frames, skips unparseable lines, and converts one-based stack columns to zero-based native coordinates. Other languages and stackless exceptions are not supported. The adapter does not fetch a URL, execute supplied code, synthesize a stack, or invent a source location.

A normal log requires `body.stringValue` plus string attributes `code.file.path` and `code.function.name`, and intValue attributes `code.line.number` and `code.column.number`. The producer must supply the real code location and function; file and function must be nonblank. Both input coordinates are one-based; column is converted to zero-based. The native event type is `Log`. Native coordinates allow lines 1–10,000,000 and columns 0–10,000,000. Stackless arbitrary logs without these attributes are rejected.

Optional `spool.event_type` is exactly `log` or `exception`. When absent, the presence of any of the three exception attributes selects exception mapping; otherwise log mapping applies. Explicit log type combined with exception attributes is rejected. Event name and severity do not override this mapping. Missing required attributes, invalid native identities, non-string log bodies and unsupported stack formats reject that record.

```json
{"resourceLogs":[{"resource":{"attributes":[
  {"key":"service.version","value":{"stringValue":"web@1"}},
  {"key":"spool.build","value":{"stringValue":"build-1"}},
  {"key":"deployment.environment.name","value":{"stringValue":"production"}}
]},"scopeLogs":[{"logRecords":[{"body":{"stringValue":"Cache refresh failed"},"attributes":[
  {"key":"spool.event_id","value":{"stringValue":"occurrence-unique-1"}},
  {"key":"code.file.path","value":{"stringValue":"https://app.example/app.js"}},
  {"key":"code.function.name","value":{"stringValue":"refreshCache"}},
  {"key":"code.line.number","value":{"intValue":"42"}},
  {"key":"code.column.number","value":{"intValue":"7"}}
]}]}]}]}
```

## Wire and processing bounds

The request stream is bounded to 32,768 bytes, including unknown fields. Only UTF-8 JSON and identity/no Content-Encoding are accepted; optional `charset=utf-8` is supported. Unknown message fields are ignored for mapping but remain subject to structural bounds and, for record/resource/scope fields, the conflict digest. Empty exports, including `{}`, succeed. Supplied repeated fields must be arrays; explicit null messages/repeated fields are rejected by this bounded profile.

Limits are 16 resource groups, 16 total scope groups, 32 total records, 64 attributes per attribute list, 64 values per nested AnyValue array/list, attribute keys of 1–256 characters, AnyValue nesting depth 8, overall JSON container nesting 24, and a preparse structural counter of 4,096 opening containers/commas. The overall byte limit can bind before these limits. Attributes must have unique keys. AnyValue accepts empty, string, boolean, signed int64, double (including the JSON protobuf special strings), base64 bytes, array and key-value-list forms. Conflicting recognized alternatives reject. The profiling-only string dictionary reference is treated as empty. Numeric int64 values must be safe JavaScript integers; decimal strings retain full signed 64-bit precision. Timestamp uint64 accepts decimal strings or safe numbers, but is not persisted as event time. Supplied trace/span IDs must be empty or hexadecimal of the defined length; they are not stored. Severity is numeric 0–24. Unknown attributes are validated and discarded.

The entire group structure and bounds are validated before any admission. Malformed JSON, invalid UTF-8 or group/resource/scope structure returns HTTP 400; structural/byte/count overflow returns 413; media type or encoding returns 415. No event prefix is admitted for these failures. One native invalid/oversized outcome is recorded for an authenticated rejected request. Invalid resource/scope attributes reject the entire request. Invalid individual records instead contribute one native invalid outcome each. Record conversion is completed before admission starts.

Only normalized native events and a SHA-256 digest persist. Native privacy scrubbing applies to messages, function names and file paths. The digest covers the whole original record, resource and instrumentation scope with schema associations before scrubbing. Identical retry is a duplicate; a changed private attribute or resource under the same ID is a conflict even when normalized data would be identical. Unknown top-level/export/group fields are not part of a record's digest. Raw attributes, stacks, bodies, trace context and scope data are not separately stored. No source maps or debug identity are inferred by this profile; diagnostic source mapping requires separately supported native artifacts/identities.

## Responses and retries

All accepted records (including duplicates) return HTTP 200 `{}`. Permanent record rejections return HTTP 200 `{"partialSuccess":{"rejectedLogRecords":"N","errorMessage":"safe categories"}}`, even when all records are rejected. The count includes invalid records, ID conflicts and unregistered release/build records exactly once. Messages contain only fixed categories, never supplied data. A partial-success response must not be retried as a whole; fix the rejected input and export new valid occurrences as appropriate.

Authentication/origin failures retain 401/403. Rate or retained storage capacity returns 429 with Retry-After; unconfirmed storage returns 503. Non-200 responses use a JSON Status-shaped `{ "message": "safe_category" }`. Retryable failures stop processing immediately and are never disguised as partial success. Earlier records may already have committed: retry the identical request with stable event IDs to deduplicate the committed prefix. A batch is not atomic. Invalid records processed again on a retry are counted again as invalid attempts. Native intake and this adapter share one project budget; switching endpoint does not bypass limits. No retryable storage receipt is claimed from this adapter's local validation alone.

Protocol references: [OTLP/HTTP and JSON encoding](https://opentelemetry.io/docs/specs/otlp/#otlphttp), [exception log semantic conventions](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/), [official logs protobuf](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/logs/v1/logs.proto), and [official AnyValue/KeyValue protobuf](https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/common/v1/common.proto). The extra mandatory identities and real-location rules above are Spool's deliberately narrower profile.

HTTP verification is `otlpFlow({req,json,origin})` exported by `tests/otlp-flow.mjs`, called from the existing real Worker HTTP suite. It starts no server itself. The caller supplies its authenticated owner request/JSON helpers; the test sends actual project bearer HTTP requests through them and checks stored records and outcome accounting.

Requests containing only known non-log signals (`resourceSpans` or `resourceMetrics`) are explicitly refused with `unsupported_signal`; they are never accepted as empty log capture. Other unknown JSON fields retain the documented OTLP JSON ignore behavior.
