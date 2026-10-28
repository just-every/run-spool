# Spool rulings

Each ruling below shaped a clause of CONTRACT.md. The clause states the outcome; the ruling states why. RL-1 and RL-2 were moved out of the contract text and its Status Gap cells in the 28 October 2026 contract cleanup. ct's own ruling pass numbers its entries from RL-101, and those are copied verbatim from ct's ruling file. Builder defaults that still await a ct ruling are in [docs/contract/adopted-defaults.md](docs/contract/adopted-defaults.md).

### RL-1 — Loader-key inventory belongs to MIG-001

*Date:* 23 October 2026 · *Ruled by:* ct · *Governs:* SDK-023, MIG-001

SDK-023's acceptance ("replace a site's Sentry loader tag with the Spool loader configured with the same key settings; confirm lazy loading, Sentry.onLoad and an error capture") is its DONE bar. The sentence "MIG-001 lists each Sentry loader key with its settings and the replacement script tag" duplicated a duty MIG-001 already names ("JavaScript Loader Script key settings (mapped to the SDK-023 loader)"), so it moved verbatim into MIG-001 with a pointer left in SDK-023. The real-organization key inventory and replacement listing is a MIG-001 Gap, not dropped. Build rules as adopted: Spool's own per-key path, no Sentry key reuse, optional capture off by default, and no real provider call, account, device or consent.

### RL-2 — Owner-only project erasure with a count-only preview

*Date:* by 15 October 2026 (release 0.2.0 records the owner-only project erasure this default governs; the day it was adopted is not recorded) · *Ruled by:* the owner · *Governs:* ERASE-001

The owner's explicit project-root default is adopted: owner-only project erasure with a count-only preview, typed confirmation (the exact project identifier and the previewed plan) and a completion receipt with counts and times and no personal values.

### RL-101 — SDK-021: Tunnel handlers and ad-blocker delivery

Date: 2026-10-28 · Ruled by: ct · Governs: SDK-021

Question: Which forwarded client addresses may Spool trust through a tunnel?

Adopted/proposed default: Deny all tunnel-forwarded addresses; auto resolves only to connecting peer, currently the tunnel server.

Outcome: **adopt with rider**. Keep forwarded client IP denied until an installation explicitly configures and authenticates a trusted ingress/tunnel boundary; only that boundary may overwrite/validate the forwarded chain, and only the resulting trustworthy client address may populate auto identity. Untrusted input is ignored and the actual peer remains honestly labeled as proxy/peer, not end user.

Why: Sentry recognizes selected forwarded-IP headers, while trusted-proxy security guidance requires a verified forwarding hop. No common norm is established by the reviewed sources for an arbitrary customer tunnel as trusted: deny by default is safest, but permanent denial would leave the contracted client-forwarding capability unfinished.

- [Source 1](https://www.sentry.help/en/articles/13964142-why-are-my-ip-address-inbound-filters-not-working): Sentry recognizes specific forwarding headers and distinguishes request IP from the user context IP.
- [Source 2](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For): Security uses of forwarded IP must select addresses added by trusted proxies; arbitrary client-supplied values are unsafe.

- [Source 3](https://docs.datadoghq.com/tracing/trace_collection/library_config/java/): Datadog accepts configurable client-IP headers or a default header order and distinguishes peer-address resolution.

Comparison: Sentry recognizes selected forwarding headers while Datadog supports an explicit header override. The reviewed tools do not establish a shared arbitrary-tunnel trust policy; trusted-hop admission remains the conservative local requirement.

Main evidence: `CONTRACT.md:371` at `2f72a0145a60cd65f6c8eb1dbc3873fec38d34e0`.

Placement: SDK-008 owns client-address trust once; SDK-021 cites it and states only tunnel forwarding/qualification.

Engineering/proof retained: Trusted ingress configuration/positive spoof-refusal proof, a real blocker extension and the MIG-001 dual run remain engineering gaps; no owner decision is needed to choose an unsafe header.
