# Project grouping rules

In project Settings, preview stack and fingerprint rules, then save them for later native JavaScript/Python/Go and Sentry intake. The preview walks every retained event; native and Sentry occurrences receive projected destinations, while imported history keeps its source grouping. Saving never moves existing occurrences. Use the issue's explicit split/merge preview and apply/undo controls for retained corrections.

Stack rules run in order. Match `stack.abs_path`, `stack.module`, `stack.package`, `stack.function` or `family`, then apply one or more of `+app`, `-app`, `+group`, `-group`. Only `*` is a wildcard. Combine matchers with spaces; quote patterns containing spaces. Prefix a matcher with `!` to negate it. Later matching actions override earlier actions. A hidden Python traceback frame never contributes, including after `+group`.

```
stack.module:vendor.* -app
stack.function:report_wrapper -group
family:python stack.abs_path:/app/checkout/* +app
```

Fingerprint rules match any exception in the chain, message, level, logger, SDK name, platform family or tag. The first match takes precedence over the SDK fingerprint. Values after `->` are comma-separated. `{{ default }}` includes the normal chain/stack/message grouping basis; `{{ error.type }}`, `{{ error.value }}`, `{{ message }}`, `{{ level }}` and `{{ logger }}` substitute the first nonempty matching field. Unknown matchers, actions and substitutions are refused rather than ignored. Each kind allows 50 rules and 16 KiB of sanitized text.

```
error.type:KeyError tags.tenant:cedar -> checkout-account
logger:payments level:error -> payments, {{ default }}
```

Every admitted native and Sentry event records its exact policy and revision. Event grouping information explains the variant, contributing frames, effective in-app classification and matched rule lines from that snapshot. Library frames collapse in the event view while SDK-sent evidence remains intact. A later policy edit cannot rewrite that explanation or alter the raw-input retry identity. Policy activation and admission have transaction revision fences, owner writes are audited, and private archives preserve policies and event snapshots. Project erasure includes the policy store. Personal identifiers in structural grouping policy cause the existing explicit owner-erasure hold rather than an unsafe rewrite.

`GET/PUT /api/projects/:project/grouping-rules` and `POST .../preview` require the project owner, same-origin writes and current authority. Preview is keyset-paginated at 100 events with an explicit next cursor. The UI consumes every page. PUT requires the current revision; stale saves return 409.

GROUP-001 historical regrouping is the explicit selected-occurrence split/merge correction with preview, version, audit, immutable original membership and guarded undo. Native stacks keep their existing v1 identity unless an explicit rule changes the first contributing frame or fingerprint. Native evidence supplies type, message, family, frame path and function; module/package/tags/SDK metadata are unavailable without Sentry evidence. Policy changes also mark repair coverage gaps rather than implying healthy capture from absence. The owner acts as maintainer until TEAM-001 implements project roles; TEAM-001 inherits policy authority, and MIG-001 inherits grouping-rule import/preview before completion. `GET .../versions` exposes retained immutable policy versions; legacy pre-version-history audit rows retain their revision and digest without inventing unavailable policy text.
