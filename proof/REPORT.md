# Spool Settings round: save as you go, quiet reads, plain wording, erasure navigation

Branch `cloud/uip-spool-s3-settings`, started from main `34ae4feb84b9638ef3503966f68b4fce015eafa6`.
Final head: see the READY line (filled in at the end of this file).
Proof was taken on a disposable `rer demo` of this tree (after) and of fresh main (before); Cedar Market was never erased.
Everything under `proof/before` and `proof/after` is real output of the scripts in `proof/probes/`.

## Status per end state

| End state | Result | Already on main? |
|---|---|---|
| 1 SP11 save as you go (named sections) | Done: no Save button in the five named sections; each saves, shows Saved, refuses with reason + Retry | No section did. Artifact cap saved without a word on main (probe `before/sp11-probe.json`: no new text after Save). |
| 2 SP10 sections update themselves | Done for grouping rules, grouping proposals, release policy, filters and usage, organization audit, business imports; the six Refresh buttons are gone | None of the six read in the background on main (`before/sp10-probe.json`: 0 reads in 60 s, second-context changes never appeared). |
| 3 SP8 Settings wording | Done | No. |
| 4 SP18 after erasing a project | Done | No (`before/sp18-probe.json`: switcher kept the erased project; after reload "This project is unavailable"). |
| 5 Nothing else changes | Text diff of Settings, Releases, Capture, Issues and Alerts pages limited to the strings in the table below (`text-diff.txt`). Alerts and Issues pages: no difference. | n/a |

## 1. SP11: Settings save as you go

Mechanism (`src/ui/workbench/useSettingDoc.ts`, `SaveMarks.tsx`, `autosave.css`, one hook for all five sections):

- Select, toggle, radio: saves on change. Text and number fields: saves on blur, or 600 ms after the last keystroke.
- One quiet "Saved" beside the field it saved. The mark always holds its space (`visibility`/`opacity` fade, drawn by CSS so it never joins a field's accessible name), so the layout never moves and focus is never taken. A visually hidden status carries the word to screen readers. No line echoes the saved value (the "Commit author and message are now shared." line, "Grouping rules saved at revision N", "Release policy saved…", "Inbound filters saved…", "Unsaved filter changes" are gone).
- A refused save keeps the value in its field and puts one plain line under that field: `Not saved. <reason> Retry`. Raw browser text ("Failed to fetch") is mapped to the app's own sentences ("You are offline. Reconnect and try again." / "Spool is unavailable…"). A revision conflict reads "This changed somewhere else. Retry to keep your value." (or the server's own sentence plus that hint). Retry first takes the latest revision, then re-sends the same value.
- Saving never uses the page-wide `busy` flag. While a value saves, or after a save is refused, Preview, the project switcher, navigation and the field itself stay enabled and keep focus (`before`/`after` independence probe: `after/sp11-independence.json`).
- Leaving mid-write: a pending edit is sent when the section unmounts (in-app navigation) and on `pagehide` / tab hidden (`keepalive`); if that send fails it is kept in memory and re-sent on return. The first read on return waits for a save still in flight.
- A re-read taken before a save started or landed is discarded (generation counter), so it never brings back the old value (proof: `after/sp11-probe.json` → `releasePolicy.staleRead`: a stalled GET answered after the save landed, field and server both show the new value).

Confirms (one step, asked once under its field, never a dialog). My decisions:

| Change | Decision | Why |
|---|---|---|
| Grouping rules (stack, fingerprint, previous policy) | Held. Existing Preview, then **Apply grouping rules** (+ Discard changes) is the confirm. | Regroups future events; incumbent flow already previews. |
| Release ordering rule | Held. Preview release policy, then **Apply release policy** (+ Keep current rule). | Moves regression boundaries of resolved issues. |
| Commit sharing turned **on** | Held. "Agent reads, alerts and exports will carry each commit's author and message." **Share author and message** / **Keep private**. Turning it off saves at once. | Admits personal data outside the owner session. |
| Release name pattern | Autosaves (blur / 600 ms). | Shapes later intake only, trivially reverted. |
| Inbound filters (toggles and lists) | Autosave, no confirm; Preview retained events stays as an optional check. | Reversible at once and counted in the visible filtered usage. Risk accepted: a pattern typed mid-word can briefly filter more than intended until the next pause. |
| Artifact cap | Autosaves, a value that is not a whole number of bytes is not sent. | Only limits future uploads; stored maps are kept. Same risk note as filters. |

Proof for each named section (1440 and 390, `after/sp11-probe.json`, screenshots `after/sp11-*`): change a value, read it back through the API the section uses; offline (`context.setOffline(true)`): reason + Retry shown, value kept, server unchanged; online, press Retry, read back.

| Section | Change → API read back | Offline | After Retry |
|---|---|---|---|
| Commit sharing | share on via confirm → `GET /commits/sharing` share `true` | uncheck → "Not saved. You are offline. Reconnect and try again." server still `true` | `false` |
| Release policy | pattern `cedar-*` (no blur) → `cedar-*`; order `semver` via Apply → `semver` | pattern `offline-*` kept in field; server `cedar-*` | `offline-*` |
| Inbound filters | localhost toggle and message list → readback matches | toggle refused, server unchanged | toggle persisted |
| Grouping rules | typing alone saves nothing (server still `""` after a 1.5 s pause); Preview then Apply | Apply offline refused, value kept | fingerprint persisted |
| Artifact cap | `1234567` → `1234567` with a visible Saved (main: no word) | `7654321` kept, server `1234567` | `7654321` |

Other Save buttons on Settings that stay as on main in this round (not mine): Save email preferences (personal notifications), Save sharing (reports), Save scrubbing rules (g36), Save identity policy, Save recurrence policy (and its Refresh recurrence policy), Save windows (retention), Save loader settings (key Details), Save assignment (issue page), plus Refresh feedback, which is not in the six. Alerts screen buttons (Save digest settings, Save alternate, Refresh alerts, Refresh delivery) are Alerts' round.

## 2. SP10: sections update themselves

The six sections read through `useLiveRead` (default 20 s interval, paused while hidden, one read on return), apply in place only when the data changed, never overwrite a typed or held value, and discard a read that began before an action. Refresh grouping rules / grouping proposals / release policy / filters and usage / history / business imports are removed. Business imports now also reads on mount (it showed "Off by default" until opened on main).

Audit note (a finding, handled): `GET /api/audit` and `GET …/grouping-proposals` are named audit reads, so polling them would write audit rows every 20 s per open tab and make the audit list grow by itself. A background read now sends `X-Spool-Background: 1`; for a signed-in owner or member the server skips the success row for those two doors only (`src/domain/audit/request.ts` `quietRead`). The first, foreground read of each mount is still recorded exactly as on main; denied, credential and export reads are always recorded.

Proof, 60 s hold on `/projects/cedar-market/settings` (`after/sp10-probe.json`, screenshots `after/sp10-*`), run after one background cycle had passed so the page's own opening reads (which write their own audit rows) had already shown up:

| | 1440 | 390 |
|---|---|---|
| Field mid-edit (grouping fingerprint rules), page scrolled 900 px, disclosure open, 390 menu open | kept | kept |
| Elements added / removed under `#content` in 60 s | 0 / 0 | 0 / 0 |
| "Loading" / "Refreshing" flashes (sampled every 100 ms, 600 samples) | 0 | 0 |
| Scroll, typed text, open disclosure, focus, menu state at start vs end | identical | identical |
| Reads in 60 s | 3 of each section read (grouping-rules, versions, proposals, corrections, release-policy, commits/sharing, inbound-filters, outcomes, imports/business, audit) | same |
| Change made from a second context through the API (release pattern, commit sharing, localhost filter) shown on the open Settings with no click | after 12 s | after 12 s |

The full request log of the hold is in the JSON (`requestLog`). Before (main): 0 reads of these sections in 60 s, none of the second-context changes ever appeared (`before/sp10-probe.json`).

## 3. SP8: Settings wording

Every changed user-visible string (full before/after text of the Settings, Releases, Capture, Issues, Alerts pages in `text-diff.txt`; erasure preview in `before|after/text-erasure-preview.txt` and `sp8-1440-erasure-preview.png`).

| Where | Before | After |
|---|---|---|
| Project keys paragraph (`SettingsView.tsx`) | "…submit inert grouping proposals…" | "…submit suggested grouping changes…" |
| Agent handoff (`AgentHandoff.tsx`) | "…can submit inert grouping proposals…" | "…can submit suggested grouping changes…" |
| Release identity paragraph | "Native v1 still requires a registered release and build." | "Native events still require a registered release and build." |
| Filter checkbox labels (source `src/domain/filters/types.ts` `filterToggleLabels`, served as `toggleLabel`) | "Enable browser extensions", "Enable legacy browsers", "Enable localhost and loopback", "Enable known web crawlers", "Enable react hydration errors", "Enable chunk and dynamic import failures", "Enable client ip addresses and cidrs", "Enable error message patterns", "Enable releases", "Enable environments", "Enable allowed browser domains" | "Block errors from browser extensions", "Block legacy browsers", "Block localhost and loopback traffic", "Block known web crawlers", "Block React hydration errors", "Block chunk and dynamic import failures", "Block client IP addresses", "Block matching error messages", "Block listed releases", "Block listed environments", "Accept only listed browser domains" |
| Erasure preview and receipt, tables that printed a raw name | `issue_priorities`, `artifact_storage_settings`, `retention_runs`, `short_id_prefixes`, `issue_short_ids`, `commit_sharing`, `follow_up_feed_custody`, `release_order_keys`, `audit_actor_links`, `release_policies`, `issue_resolutions`, `inbound_filter_policies`, `deployment_manifests` (and 92 more declared tables) | "Issue priorities", "Source map storage cap", "Retention runs", "Issue short IDs", "Issue short ID assignments", "Commit sharing setting", "Follow-up feed records", "Release ordering", "Audit links", "Release policies", "Issue resolutions", "Inbound filters", "Deployment manifests"… every table in `declaration.ts` (edges, redact, retain) now has an entry in `erasureLabels.ts`; the fallback humanises (`spool_x_y` → "X y"), never printing a table name |
| Erasure labels renamed | "Dev-minted key marks", "Development outbox messages", "Spike cursors", "Alert cursors", "Alert intents", "Fix step leases", "Scheduler cursor" | "Ingest keys", "Development mail messages", "Spike check positions", "Alert expansion positions", "Planned alert deliveries", "Fix step claims", "Scheduler position" |
| Kept on purpose (server, `declaration.ts`) | "Used Business grant nonces stay so no grant can be replayed; they hold an action, key id, expiry and namespace name, never record content." | "Records of used Business grants stay so no grant can be used twice; they hold an action, key ID, expiry and namespace name, never record content." |
| Kept on purpose (server) | "Portability tombstones stay as keyed hashes so older archives are refused on restore." | "A one-way fingerprint of each deleted record stays, so an older archive is refused if someone tries to restore it." |
| Wording that follows from removing Save | grouping intro "…then save for later intake." | "…then apply them to later intake." |
| | "Approved agent rule proposal opened for review. Save grouping rules explicitly to change later intake." | "…Apply grouping rules explicitly to change later intake." |
| | "Previous policy loaded as a draft. Preview and save it as a new revision to roll back." | "…Preview and apply it as a new revision to roll back." |
| | "Grouping rule revision conflict. Refresh the approved proposal." | "…Reopen the approved proposal." |
| | filters intro "Preview your changes against retained events, then save for later intake." | "Changes save as you make them and apply to later intake; preview them against retained events first if you like." |
| Removed controls / lines | "Save grouping rules", "Save release policy", "Save commit sharing", "Save inbound filters", "Unsaved filter changes", "Save artifact cap"; Refresh grouping rules / grouping proposals / release policy / filters and usage / history / business imports; echo lines ("Grouping rules saved at revision N…", "Release policy saved for later intake.", "Inbound filters saved. Later intake uses this policy.", "Commit author and message are now shared / no longer shared.", "…refreshed" notices) | "Apply grouping rules", "Apply release policy", "Share author and message", "Keep private", "Discard changes", "Keep current rule" (confirm steps), the Saved mark, `Not saved. … Retry` |

Left alone on purpose: the exception line with `ALERT_DESTINATIONS` and "D1 Time Travel" (Alerts round names `ALERT_DESTINATIONS`), code identifiers, API fields, log keys. No test pinned a changed declaration string (`tests/project-erasure*.mjs`, `tests/owner-erasure*.mjs` assert counts and structure only).

## 4. SP18: after erasing a project

`ProjectErasure` hands the completed receipt to `WorkspaceView`, which moves the route to the remaining project's Issues (or `/`, the start of a new project, when none remains), drops the project from the switcher once the route has left it (so no frame says "unavailable"), refreshes the workspace, and shows the same receipt (same section, heading, focus) above the destination. Continue lands the same place without a page reload. An in-progress receipt still renders in place and follows the erasure.

Proof on a test project created in the demo (`before/sp18-probe.json`, `after/sp18-probe.json`, screenshots `sp18-*`):

| | Before (main) | After |
|---|---|---|
| URL after "Project erased" | `/projects/<erased>/settings` | `/projects/cedar-market/issues` |
| Switcher | still offers the erased project | only Cedar Market |
| Heading | Settings | Issues, receipt "Project erased" shown above |
| Issues link | goes to `/projects/<erased>/issues` | stays on Cedar Market |
| `/projects/<erased>/issues` | "This project is unavailable" after reload | same (it is erased); never shown in-app |

No project remains: `tests/project-erasure/ui.mjs` (existing journey, one project) now asserts the app opens "Create your first project" and never says "This project is unavailable" (passes, below).

## Tests touched (no new test file, no new registration)

The one new core-flow scenario extends the existing `SDK-006` filter journey (`tests/inbound-filter-flow.mjs`, both widths): a toggle autosaves with no Save button (Saved mark seen), a refused save while offline keeps its value and shows "Not saved. You are offline", Retry persists it; the stale-revision case asserts the plain reason and Retry. Updated by name because the buttons or text they used are gone:

- `tests/grouping-rules-flow.mjs`: Save grouping rules → Apply grouping rules; status "Grouping rules saved" → the Saved mark (all four sites).
- `tests/inbound-filter-flow.mjs`: checkbox names `Enable <label>` → the API `toggleLabel`; Save inbound filters → wait for the policy to land; Refresh filters and usage removed; conflict case now asserts the plain "Not saved. This changed somewhere else" (was the raw `inbound_policy_revision_conflict`) and Retry; Retry filters wait uses Preview button.
- `tests/operator-ui.mjs`: Refresh grouping proposals → a window focus (the return-to-tab read); Save → Apply grouping rules; approved-proposal sentence; Saved mark.
- `tests/release-identity-flow.mjs`: Save release policy → Apply release policy when the ordering changed, Saved mark; commit sharing now asks once (Share author and message).
- `tests/source-map-capacity.mjs`: Save artifact cap → the cap saves on its own (Saved mark); the two "unsaved draft" messages now say the edit is saved on leaving.
- `tests/audit-history.mjs`: Refresh history → a window focus; the last Refresh status line → the list reappears.
- `tests/project-erasure/ui.mjs`: added the landing / switcher assertions.

## Checks run (actual)

Code commits (before proof and lock): `88cd29b`, `55b4f66`, `7faefb8`. Only the proof folder and `sources.lock.json` come after `7faefb8`.

| Check | Where | Result |
|---|---|---|
| `tsc --noEmit` (typecheck) on the final tree | local | exit 0 |
| `node scripts/edition-authoring/cli.mjs lock` then `check` (source lock regenerated last) | local | check exit 0, `"ok": true` |
| `node src/base/contract-docs.mjs check` (no CONTRACT.md change) | local | "Contract documents are current.", exit 0 |
| Migration ledger | no migration added or changed | n/a |
| `node tests/project-erasure.mjs` (includes `tests/project-erasure/ui.mjs` with the new landing assertions, 1440 and 390) | heavy-slot, m1-runner, committed `88cd29b` | exit 0, "Project erasure public journey passed: 7 groups; 8 captures." |
| `pnpm build:app`, then `tests/sentry-http.mjs` (runs `grouping-rules-flow`, `inbound-filter-flow` with the new autosave scenario, `release-identity-flow`), `tests/sdk-package.mjs` (`source-map-capacity`), `tests/old-archive.mjs` (`audit-history`), `tests/triage-journey.mjs` (`operator-ui`) | heavy-slot, m1-runner, committed `7faefb8` | all four PASS, exit 0 (546 s). An earlier batch on `55b4f66` failed in `grouping-rules-flow` (Apply was missing when a preview was shown for an unchanged draft); fixed in `7faefb8` and rerun. |
| Public-door probes against a fresh disposable `rer demo` of the tree | local, headless Playwright, real HOME, mock keychain | see per-end-state tables; JSON under `proof/after` |
| No full local verify, no suite baseline, no CI dispatch | | not run |

Public-door probe index (script → output): `probes/sp11-after.mjs` → `after/sp11-probe.json` (+ screenshots) · `probes/sp11-independence.mjs` → `after/sp11-independence.json` · `probes/sp10.mjs` → `before|after/sp10-probe.json` · `probes/quiet-read.mjs` → `after/quiet-read.json` (3 background read pairs left no audit row, 3 foreground pairs added 3 + 3) · `probes/sp18.mjs` + `probes/unavailable.mjs` → `before|after/sp18-*.json` · `probes/textdump.mjs` → `before|after/text-*.txt`, `text-diff.txt` · `probes/sp11-before.mjs` → `before/sp11-probe.json` · `probes/grouping-conflict.mjs` (stale revision Apply shows "Not saved. Grouping rule revision conflict. Retry to keep your value.").

Leaving and control independence (`after/sp11-independence.json`, both widths): with the save held in flight, the field kept focus and stayed editable, Preview ran in 144 to 218 ms, the project switcher and navigation stayed enabled, and the server still held the old value until release; after an offline refusal the same controls stayed enabled and the value stayed; typing then following the Releases link left the edit on the server (`left-midwrite-*`); typing then `about:blank` (page hide) left the edit on the server (`hidden-midwrite-*`).

## Scope and notes

- Scope kept: workbench Settings components, the shared live-read/save hook, `SourceMapSetup` (artifact cap, shared by Releases/Capture), `ProjectErasure`, workspace/project-switcher state, filter-label and erasure-preview maps, plus the two small server touches above (filter `toggleLabel`; audit `quietRead`) and the two erasure strings. No Alerts, homepage, docs, Base pin, migrations, clauses or statuses changed; no migration was added, so the migration ledger is unchanged.
- g36 Scrubbing rules and the other Save buttons are as on main.
- Inherited, nonblocking: "D1 Time Travel", "ALERT_DESTINATIONS" and "journal" remain in one erasure exception sentence; `Refresh recurrence policy` and `Refresh feedback` remain; Settings logs a React duplicate-key console warning for `cedar-market` that I did not trace (not investigated, not introduced knowingly); a pattern typed mid-word autosaves after the pause (filters, artifact cap), by the brief's own rule.
- A held edit (one awaiting its confirm) is not sent on leaving; it was never confirmed.
- Probe scripts are in `proof/probes/` (they read the demo's gate key from a private scratch log that is not committed). The `rer demo` start line printed that throwaway local demo's gate key once into this session's output; the demo is stopped.
