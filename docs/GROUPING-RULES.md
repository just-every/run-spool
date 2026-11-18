# Project grouping rules

In project Settings, preview stack and fingerprint rules, then save them for later native JavaScript/Python/Go and Sentry intake. The preview walks every retained event; native and Sentry occurrences receive projected destinations, while imported history keeps its source grouping. Saving never moves existing occurrences. Use the issue's explicit split/merge preview and apply/undo controls for retained corrections.

<details>
<summary>Details</summary>

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

Event grouping information explains the contributing frames and matched rules used for that event. Library frames collapse in the event view while the original evidence remains intact. Later policy edits do not rewrite that explanation.

</details>
