# Adopted builder defaults

These are defaults a build round adopted while a clause's question waited for a ct ruling. They are mechanism, not rulings: each clause's Gap names the open question, and a ct ruling replaces the default when it arrives (RULINGS.md). Each entry was moved verbatim from the Status Gap cell named, in the 28 October 2026 contract cleanup.

## SDK-005 — session users

Default ADOPTED: session users use keyed per-project hashes only until full SDK-008 policy; the key is private-archive-only.

## SDK-008 — identity policy default

Gap: Default ADOPTED: all four fields drop; keep/hash require an explicit owner choice. The clause's keep-as-sent default remains an open ruling.

## SDK-021 — tunnel trust

Default ADOPTED pending ct (ct ASK open: which tunnels Spool may trust): deny by default; no tunnel is trusted, `{{auto}}` resolves only from the connecting address, so events through a tunnel carry the tunnel server's address. ct ruled on 28 October 2026 (RULINGS.md RL-101), which keeps denial until an installation configures and authenticates a trusted boundary.

## SDK-024 — check-in routing

Defaults ADOPTED: DONE needs the real Uptime door; only what the SDK data truthfully carries links an error to a check-in.

## ALERT-002 — Slack alerts

Default ADOPTED: Slack posts a sanitized summary and exact issue link only; no interactive action or Slack app endpoint, and the recorded edge double earns no real-Slack claim.

## REL-002 — suspect changes

Default ADOPTED: a suspect is only a labelled candidate; no automatic agent action. Under the contract standard, any agent action on a suspect is a call whose class the company's policy decides; this default records only what the build shipped.
