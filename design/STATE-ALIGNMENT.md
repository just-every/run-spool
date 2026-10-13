# Errors state alignment — 2 October 2026

The four remaining 12ui alignment kits are complete and reviewed against their
approved images, generated specifications and synthetic application captures.
This milestone supplies the adaptation decisions and source-custody comparison.
It does **not** claim that the proposed source changes have been applied or that
the four screens match the approved images pixel for pixel.

The reviewed domain candidate is `b2eb94aaa4d9fd1ea3d8e5f71535a9751bbf54e3`.
The observed working tree also contains the product owner's UI/accessibility
changes. Domain clearance at that commit and independent accessibility findings
are separate evidence; this document does not extend either verdict. This review
changed only this document, without credentials, state mutation, installs,
conversion replay, new purchases, commits, upload, deployment or provider action.

## Comparison inputs and limits

Original design custody is recorded in [README.md](README.md): original generated
12ui candidate C, its five-state branch, approved images and retained
[`prototype/`](prototype/). Runtime source remains
[`src/ui/Workbench.tsx`](../src/ui/Workbench.tsx),
[`generated-design.css`](../src/ui/generated-design.css) and
[`workbench.css`](../src/ui/workbench.css). The prototype is a design reference;
its sample values and scripts do not establish application requirements.

| State | Approved original, 1536 × 1024 | Actual synthetic capture | Completed kit |
| --- | --- | --- | --- |
| Issues | [approved-issues.png](approved-issues.png) | [issues.png](../.artifacts/accessibility-and-design-states/issues.png), 1280 × 1849 | [issues followup](../.artifacts/design-alignment-issues-followup/README.md) |
| Capture | [approved-capture-setup.png](approved-capture-setup.png) | [capture.png](../.artifacts/accessibility-and-design-states/capture.png), 1280 × 1488 | [capture followup](../.artifacts/design-alignment-capture-followup/README.md) |
| Releases | [approved-release-setup.png](approved-release-setup.png) | [releases.png](../.artifacts/accessibility-and-design-states/releases.png), 1280 × 1814 | [releases followup](../.artifacts/design-alignment-releases-followup/README.md) |
| Packet | [approved-evidence-packet.png](approved-evidence-packet.png) | [packet.png](../.artifacts/accessibility-and-design-states/packet.png), 1280 × 2227 | [packet followup](../.artifacts/design-alignment-packet-followup/README.md) |

Each kit's README, annotated plan, asset table and token patch were inspected.
All four report **unanchored**, 0% before/target matching, unresolved application
selectors and no actionable matched changes. Each token patch contains an empty
`:root`; there is no recurring token delta to apply. These are independent
target specifications, not verified diffs against the React application. The
`winner.png` files retain the approved targets: decoded local RGB comparison
confirmed identical 1536 × 1024 pixels for all four pairs, although their PNG
encodings differ. Generated responsive HTML and mobile reference images remain
comparison material.

The actual captures use browser-only synthetic fixtures. They demonstrate layout
and the displayed boundaries, not production capture, exposure or repair. The
1280px application breakpoint moves the evidence rail below the main content;
the approved 1536px references keep a desktop summary at the right. Full-page
image heights therefore cannot be compared as one common viewport geometry.
The actual issues capture is the **selected issue** state, while its approved
target is an **issues list with selected detail**. The actual packet capture is
that selected issue with packet details expanded, while the target is a focused
packet screen. Those state differences require an explicit adaptation, not an
image-diff score presented as conformance.

## Source changes proposed to the product owner

Apply changes through state-scoped React wrappers and CSS in the existing files.
Keep the accepted selected-issue composition and its global breakpoints. The
current global shell uses a 285px desktop sidebar, 774px central column and a
minimum 310px evidence rail; at 1300px it changes to a 240px sidebar and one
main column, and at 650px to a vertical layout. Changing these globally to each
generated state's shell would disturb the previously accepted screen.

The approved branch consistently uses a dark textured navigation area, warm
paper ground, thin panel boundaries, compact headings and restrained orange,
green and blue state accents. Keep those existing assets and hierarchy. The
current 13px body and 25px heading already lie within the original branch's
12–14px body and 23–27px heading range. Keep the current font fallback; the
conversion's Inter/Roboto Mono declarations do not justify loading another font.
Keep the accessibility corrections to muted text (`#625f58`) and input borders
(`#858076`) rather than copying the references' paler text and outlines.

The sidebar in the supplied 1280px captures lets its project picker and subtitle
press beyond the 240px boundary. The bounded source proposal is to give the
brand text child `min-width: 0; flex: 1`, wrap the subtitle, and constrain the
project select to its available width (`width: 100%; min-width: 0; max-width:
100%`). Retain the full accessible project name. The independent UI reviewer
owns the final accessibility disposition.

| State and plan anchors | Adaptation in the actual source | Functional boundary preserved |
| --- | --- | --- |
| Issues: Added 61–69 heading/toolbar, 70–88 totals, 94–189 rows, 190–227 detail | Keep the current selected detail as the accepted implementation. Improve the existing `.error-list` buttons' chosen-state clarity and label retained counts. A future list surface can use the original row geometry around real issue data, with real first/last received times and the four supported triage states. Do not add inert search, filter or sort controls simply to occupy target boxes. | The existing fetched list is bounded to 100 groups and displays `100+` at the limit; it cannot support unqualified total-installation statistics or percentages. No service field, unique-user denominator or sample trend is available. `acknowledged` and `suppressed` remain the actual states; sample “In progress” does not change the protocol. |
| Capture: Added 80–102 numbered instructions/card/code blocks | Replace the single undifferentiated setup panel with a semantic ordered sequence: use the helper, initialize registered identity, then capture and inspect the result. Reuse the existing exact `/errors-capture.js` initializer snippet, password field, registered-release select, `testCapture`, outbound preview, admission result and exact retry action. Use the original `.step` relationship: 32px number, explanation, code/control column, 18px gap; let code/controls span below the explanation as space narrows and become one flow on mobile. | No sample `@error-tracker/js` package, DSN or external endpoint. Browser capture stays same-origin; Worker callers await capture or use `waitUntil`. A successful local test demonstrates that occurrence's admission, not total coverage or production repair. |
| Releases: Added 25–33 release details, 69–105 map association, 108–136 summary | Group the existing registration form and private map form as a coherent setup sequence. Use 14–16px panel headings, compact detail rows and a state-scoped summary containing selected registered release, build and registration sequence from `currentRelease`. Keep summary below forms at narrow widths. The prototype's desktop relationship is a 778px setup column plus a 280–362px summary with 25px gap; adapt it within the existing shell instead of replacing global columns. | Registration order is explicit comparison identity and does not prove deployment. Source maps require exact project/release/build/debug-ID matching, not filename matching. Keep native file input, max 256 KiB, JSON parsing/error handling, disabled-until-valid submit and confidentiality copy. No fictitious JS bundle upload inventory, artifact totals, mapped counts, Draft badge, optional build identifier, remote URL linking or unimplemented drag/drop. |
| Packet: Added 79–84 inconclusive notice, 85–117 overview/frames, 118–134 counters, 191–222 download/boundaries | Within the existing packet panel, place the actual inconclusive reason and unknown-coverage boundary beside the download/checks, before the exact JSON disclosure. Use the original overview rhythm for real issue/release identity and permitted frame diagnostics; derive any displayed included-event count from `packet.events.length`, clearly distinct from retained group occurrences. Preserve the native disclosure, focusable scroll region and download handler. A focused packet surface is a later source choice, not claimed to exist in this capture. | Retain exact sanitized packet bytes, grouping limitations, observed counters and immutable admission/current lookup distinction. Do not infer a reproducer ran. Keep residual-free-text inspection and untrusted/no-execution labels. No “safe to share/no personal data” guarantee, sample 248 KB, redaction match report, network metadata, console/user-action counters or replay features. |

Capture's empty-state artwork and “No events yet” text are conditional on a
genuinely empty project. The populated synthetic capture must not display them.
Its generated permission/sign-in card (Added 103–108) is omitted for the already
signed-in owner. Keep the actual owner-session model and its real sign-in screen;
sample team membership does not add an authorization role.

Generated mobile references also need adaptation: capture's reference drops the
initializer code, packet's reference drops the download card, and release's
reference duplicates a release status line. The actual responsive application
must keep its code, file selection, JSON, download, sign-out and error feedback
reachable. These images are visual references, not responsive acceptance tests.

## Raster adaptation and retained custody

No raster was silently discarded or redrawn. Every extracted layer remains in
its original ignored kit; the shipping decisions below intentionally adapt
reference-only content to the product contract. Alternate resolutions follow
their underlying layer's decision; do not ship both. The raw approved/winner
screenshots and normalized source captures are never runtime backgrounds.

| Raster group in completed plans | Decision and reason |
| --- | --- |
| Issues `clean-0`; capture `clean-0` | Keep the already-shipped original paper tile across states to preserve the accepted selected screen. The issues clean plate was visually inspected and contains texture only; both extracted plates remain available references. Do not add a second full-frame backdrop or flatten controls into an image. |
| Issues `crop-239`, `crop-240`, `crop-244`; capture `cutout-66`–`cutout-69`; packet `crop-68`–`crop-71` | Reference only. These are generated portraits tied to invented people, team presence or activity. No real avatars or team capability is represented by the current owner-session UI. |
| Issues `cutout-2`; capture `cutout-2`; releases `cutout-2`; packet `cutout-3` | Reference only. These are Project Aurora sample marks. Preserve the current provisional Errors identity; no public branding decision was made. |
| Capture `cutout-77` | Safe original decorative illustration for an actual empty state only, with empty alt text. It is omitted from this populated fixture. If adopted, copy this cutout or the original prototype illustration; preserve its aspect ratio and do not recreate it in CSS. |
| Issues `cutout-95`, `cutout-191` | Keep the already-shipped original selected-issue `error-marker.png` rather than duplicate variants. It is a real raster, decorative, accompanied by textual state/type. |
| Issues `cutout-107`, `cutout-119`, `cutout-131`, `cutout-143`, `cutout-155`, `cutout-167`, `cutout-179` | Reference only. Per-row amber/yellow/gray sample severity is not an implemented severity model. Do not assign those colors from the sample rows. |
| Issues `cutout-11`, `cutout-28`, `cutout-69`, `cutout-205` | Optional real navigation/release decoration only when mapped to an existing control. Sort artwork is omitted because its target sort control is not implemented. Calendar/source-map art does not create a route or date model. |
| Capture `cutout-8` | Reference only. The sample Overview route has no actual counterpart. |
| Releases `cutout-11`, `cutout-35`, `cutout-43`, `cutout-49`, `cutout-55`, `cutout-61`, `cutout-74`, `cutout-90`, `crop-97`, `cutout-79`, `crop-87` | Navigation/upload artwork may decorate actual existing controls if the owner adopts it. File/status rasters remain references because the sample bundle inventory and successful frame-count rows are not actual UI data. Never show a resolved-status icon without the corresponding actual diagnostic. |
| Packet `cutout-13`, `cutout-113` | Optional decoration for existing releases navigation or actual stack frame panel only. Omission retains the already-accepted text/control layout; adding them must not create a new capability. |

The existing runtime textures are original generated prototype assets, checked
byte for byte:

| Runtime file | Retained source | SHA-256 |
| --- | --- | --- |
| `public/design/paper.png` | `prototype/p0-selected-issue.assets/paper.png` | `75ff4d75a6bc91e3c2705dfb5f5613da0ea435707335df9e221e3240e257c76a` |
| `public/design/dark-material.png` | `prototype/p0-selected-issue.assets/dark-material.png` | `e3dab85c5eaa08039e21fa0263bc6ff1dc64b52ff7dcd269a8c385e9a92724e8` |
| `public/design/error-marker.png` | selected-issue kit `cutout-102-04028d79582d.png` | `04028d79582dbba3382b0318d1afc1f04285fad09c48b9f5bccce211b181ca87` |

This original-source comparison does not import competitor branding, proprietary
server code or private evidence. It does not establish public asset licensing or
branding acceptance beyond the original-source custody already recorded.

## Evidence identities

Hashes below identify the actual inspected image bytes. The kits separately
record their dispatched input hashes in `improve.json`; those must not be
substituted for these current screenshot hashes. Normalized `source.png` and
the current fixture images are visually equivalent in their layout/content but
not byte/pixel-identical: local RGB comparison found only very small text-edge
deltas (mean absolute channel difference approximately 0.003–0.005 on 0–255).
This comparison is custody evidence, not pixel-conformance scoring.

| State | Approved target SHA-256 | Actual fixture SHA-256 |
| --- | --- | --- |
| Issues | `abac373254893307677540803a844c65b6806d8366cd39cbbfd17b9465ab00db` | `9eb6536c7eca4dc12f2664631904d8005faf32c682160ccce4f65852c4a66aeb` |
| Capture | `4f95e2d56877892da947e682f44fa57191e591fa80698c80ca14ce17b3fc3fab` | `4c8bb8180d94173c19d5d076b61594cb685b3a562a3d0d14dc4ec733cbf184ac` |
| Releases | `ae2db25df4e43248cd0d187c039ee223d5537ef466266be4848a7d121a62ea17` | `bcb11ff29ef99ac52137e67cd0117231616824a0ce1f3048f8659888abb3184f` |
| Packet | `71340eb21e57b9b67543981e938ed806a3eb74bddf261672c1cb1f34ffca0501` | `b5425fc2cd0f9e38186738eb5a0f7b97e3d3deb7669f183f4b354f04a30ea796` |

| Normalized kit source | SHA-256 |
| --- | --- |
| Issues `source.png` | `506e6a15f90dfc4a4bcfd819fdd6d17f11280b537a098057df5c77bc77489cc8` |
| Capture `source.png` | `f26d1b4f26b5e1ad86a1bb57a00c26e53b172d46ea9f8dc9e8ce3b8c9ce6c395` |
| Releases `source.png` | `d99cc540e830ca178ebb10d825c82da749bbd62b0b4b84082c80bf9b9e812d97` |
| Packet `source.png` | `58e1a69eeb7272a3c2f31e7cf3a1852438eae64bf9bc255c645b313778f45b4e` |

Observed UI source hashes before any proposed adaptation:

| File | SHA-256 |
| --- | --- |
| `src/ui/Workbench.tsx` | `0a19710e41f53c9db33fa526bed90a6a6bd5c1f4f1532ad792d508b44ff50b45` |
| `src/ui/workbench.css` | `8f442eb2d2b69437b5b29017e1c26608f19d07d6a33f0328fe06b89c17d316f8` |
| `src/ui/generated-design.css` | `9b829f1e0c3c45d87ae8b9a9df7a9a71f4f2e7f96f015997b92633467be7a8c3` |

## Existing conversion ledger

The product owner kept these foreground runs. This reviewer did not launch,
resume, repurchase or query provider spend. The following rows reproduce each
completed kit's ledger; stage ceilings are not actual settled charges.

### Issues

| purchase | stage | invocation | price ceiling |
| --- | --- | --- | --- |
| `09bdf202-f183-467e-889f-761367f6983c` | convert | `improve` pid 53401, started 2026-10-02T08:38:53.935Z | $0.55 (stage ceiling, shared by 2 purchases) |
| `54a58083-113a-4a37-9b11-d5fdca6fa255` | convert | `improve` pid 53401, started 2026-10-02T08:38:53.935Z | $0.55 (stage ceiling, shared by 2 purchases) |

### Capture

| purchase | stage | invocation | price ceiling |
| --- | --- | --- | --- |
| `45cec393-51be-4b33-a528-424e3f77bfbf` | convert | `improve` pid 53511, started 2026-10-02T08:38:55.187Z | $0.55 (stage ceiling, shared by 2 purchases) |
| `4aaf2ad1-9575-405d-b24a-2a2abae35566` | convert | `improve` pid 53511, started 2026-10-02T08:38:55.187Z | $0.55 (stage ceiling, shared by 2 purchases) |

### Releases

| purchase | stage | invocation | price ceiling |
| --- | --- | --- | --- |
| `c1992d44-5c3f-432f-bf43-8e62dcbc5d82` | convert | `improve` pid 53446, started 2026-10-02T08:38:54.246Z | $0.55 (stage ceiling, shared by 2 purchases) |
| `8ba47bae-f4fe-4bbb-a9fa-8333d196f16c` | convert | `improve` pid 53446, started 2026-10-02T08:38:54.246Z | $0.55 (stage ceiling, shared by 2 purchases) |

### Packet

| purchase | stage | invocation | price ceiling |
| --- | --- | --- | --- |
| `219542ec-da4e-40fd-8cf1-f9b19ff8a101` | convert | `improve` pid 53312, started 2026-10-02T08:38:53.673Z | $0.55 (stage ceiling, shared by 2 purchases) |
| `19dad3f3-33ca-4b71-82a1-3c6e3bfe37a4` | convert | `improve` pid 53312, started 2026-10-02T08:38:53.673Z | $0.55 (stage ceiling, shared by 2 purchases) |

Each kit records two purchase IDs sharing one $0.55 stage ceiling: eight IDs
across four existing runs, aggregate stage ceiling $2.20. Actual prices are not
in these kits, and no actual-price claim is made here.

## Rendered closure still required

The product owner can apply the scoped adaptations and record fresh synthetic
captures at 1536, 1280, 768, 390 and 320px, with the same state and disclosure
positions identified. Pair the 1536px views with their corresponding approved
originals; compare narrower widths for real-control preservation and overflow,
not against an unrelated stretched desktop frame. Preserve selected-issue
acceptance when applying shared CSS.

The implementation review must include populated/empty issues, populated/empty
capture setup, preview/admission/error states, release selection and invalid
replacement file, and packet collapsed/expanded/download visibility. Keyboard
focus, accessible names, input boundaries and readable text stay subject to the
independent UI report. New local screenshots must remain explicitly synthetic
and require no new credentials or production state. The owner should tie any
implementation claim to its actual source revision and fresh verification.

The design comparison and adaptation mapping are complete. Source adoption,
rendered post-adaptation closure and broader/provider acceptance remain separate
work; no exact pixel-conformance claim is supported by these unanchored plans.

## Post-adaptation closure

The owner applied the shared shell and capture adaptations. Final synthetic
[issues](../.artifacts/accessibility-and-design-states-final/issues.png),
[capture](../.artifacts/accessibility-and-design-states-final/capture.png),
[releases](../.artifacts/accessibility-and-design-states-final/releases.png) and
[expanded packet](../.artifacts/accessibility-and-design-states-final/packet.png)
captures were inspected against the approved originals and the mapping above.
The 1536px desktop shell now has the original 313px sidebar relationship, with
the project picker contained and packet/download/accounting at the right.
Capture visibly separates registered identity, the actual helper snippet and
real-admission controls into three numbered panels. Its same-origin and
Worker `waitUntil` boundaries remain explicit. The decorative empty-state
illustration is the original prototype raster (`empty-capture.png`, SHA-256
`37311a559d6be7c04848d07764b3dd2a0dc43038dd8ac1031ea945a582651ba7`);
it is absent from the inspected populated captures.

Releases retains the actual registration/private-map/list sequence, and packet
retains its selected-issue disclosure with exact JSON and visible download.
The original standalone issues-list and focused packet layouts remain intentional
departures; the optional release-summary proposal was not applied. No generated
team portraits, sample providers, unsupported inventory or privacy/repair
guarantees were introduced. The earlier source/image hashes describe the
pre-adaptation comparison; these are the final inspected UI bytes:

| File | SHA-256 |
| --- | --- |
| `src/ui/Workbench.tsx` | `cf6f13cf7d7746cfba70fe157afc0c3e7bd0a7d1e2956c9c588b247131b25991` |
| `src/ui/workbench.css` | `9d28620e1f5d6228daff3941e7ded05b79db9a8466c109d97e97502aac1fe7cc` |
| `src/routes/__root.tsx` | `ea241582779aca6f3bae37b700b257bb05a10a75e41c9abe93d6c15ce8a42ca6` |

The independent [UI follow-up](../.artifacts/ui-accessibility-followup/REVIEW.md)
records stable matching UI hashes, 27 tested screen/state combinations, ten axe
states with zero violations, and no unresolved reproduced finding in its bounded
Chrome scope. Texture contrast retains manual-review limits; this is not WCAG
certification or a real-mutation/provider/whole-release verdict. The applied
adaptations and their declared departures are now visually closed for these
synthetic captures. Exact pixel conformity remains unclaimed.


The subsequent issue-browsing followup is described in [ISSUE-BROWSING.md](../ISSUE-BROWSING.md): a real bounded groups table now supplements the selected detail, using the original issues rhythm. The source hashes and captures above remain the preserved a616e2e alignment milestone, not a claim that this later list matches the reference pixel for pixel. Its separate functional/keyboard review is recorded in HANDOVER.md.
