---
target: /dashboard
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-21T09-05-57Z
slug: app-dashboard-page-tsx
---
# Critique (re-run) — Reticle Console `/dashboard`

## Design Health Score

| # | Heuristic | Was | Now | Key issue |
|---|-----------|-----|-----|-----------|
| 1 | Visibility of System Status | 3 | **4** | Live counts + SLA timers + sort/ack/resolve `aria-live`; banner→Incidents nav (the lens change is the feedback) |
| 2 | Match System / Real World | 4 | **4** | SRE vocabulary exact + honest ("live-fire proving logged") |
| 3 | User Control and Freedom | 2 | **4** | Two-step Confirm + 6s **Undo** toast + Escape + Roll back/Hold — the missing recovery primitive now exists |
| 4 | Consistency and Standards | 3 | **4** | Shared AutonomyChip; standards-perfect sortable table; consistent incident action strips |
| 5 | Error Prevention | 2 | **4** | High-blast approvals gated; promotion blocked while owned service burns — safety now proportional to consequence |
| 6 | Recognition Rather Than Recall | 4 | **4** | Map legend, sort glyphs, `↵` hints, proving stepper |
| 7 | Flexibility and Efficiency | 2 | **4** | List sortable by any column; Cmd+K; header shortcuts. (Still no bulk Queue actions) |
| 8 | Aesthetic and Minimalist Design | 4 | **4** | Restraint intact; flat-by-default now genuinely flat |
| 9 | Error Recovery | 2 | **4** | Incident Resolve + Undo + Roll back/Hold; "IC unassigned" now has Assign IC |
| 10 | Help and Documentation | 3 | **3** | Self-documenting legend/dossier/caption; no first-run onboarding, L1 canvas click model undiscoverable cold |
| **Total** | | **29** | **35/40** | **Top of "Good," one point from "Excellent" — operability is now real, not just legibility** |

## Anti-Patterns Verdict — still emphatically not AI-generated.
- **Design review:** all absolute bans cleared on live inspection (no side-stripes, gradient text, glassmorphism, hero-metric template, identical-card grids, hacker costume); square corners, `tabular-nums`, health = the only saturated color, autonomy = position+ink. No console errors across the 9-lens walk.
- **Deterministic scan:** `detect.mjs` over all of `components/` + `app/` → **exit 0, zero findings** (second clean run). The two previously-flagged ambient drop-shadows (AgentDossier, CommandPalette) are **confirmed removed**; a manual pass on every new component (ToastStack, the two-step Confirm, sortable List, the lucide glyph, Scatter reference lines) found **no new slop**, and `.ret-toast-in` is correctly inside the `prefers-reduced-motion` block.

## Overall Impression
A substantive, honest fix pass. **Every P1 and P2 from the 29 baseline is resolved** (one P2 partially), and the new **incident→promotion→World** causal thread is the strongest thing in the product: resolving INC-205 converts a fire into proving-ground evidence → trust rises → promotion unblocks → the EvidenceLedger and World code-slice record the provenance. "Trust is earned through verifiable evidence" is now a working mechanism, not a slogan. The gap the last critique named — legible (4-tier) but only sparingly operable (2-tier) — is closed; acting is now ~4-tier too.

## Prior-issue resolution
RESOLVED: on-call cockpit dead-end (Ack/Assign IC/Open/Map/Resolve + aria-live) · unguarded approvals (two-step Confirm + Undo) · unsortable List (full `aria-sort`, announced) · Flat-By-Default shadows (gone) · Scatter collisions/reference lines · unicode glyph→lucide. **PARTIAL:** select-vs-open is now signposted in List + L2 canvas + Promote, but the canvas loads at **L1** where the open affordance is absent.

## What's Working
1. **The incident→promotion→World thread is a complete, honest causal story** — an operational action visibly *earns* an agent more autonomy, recorded in the ledger and reflected in the world model (invariants flipped `✗ 4.2` → `✓`).
2. **Error-prevention is proportional to consequence** — two-step confirm gated on blast radius + universal Undo + promotion blocked while the owned service burns.
3. **The List lens is now a first-class triage/keyboard spine** — multi-column sort, correct `aria-sort`, live-announced, glyph-marked.

## Priority Issues (current — all P2/P3)
**[P2] Select→open is undiscoverable at the default canvas (L1) zoom.** The `Maximize2` glyph + hover hint live only on L2 cards; the board loads fitted at L1, so a cold user single-clicks (selects) and never reaches the dossier. *Fix:* an L1 corner tag or a one-time canvas coachmark. → `/impeccable onboard`

**[P3] No default "cockpit" composite for the 3am loop.** Triage→clear-approval→check-downstream still spans Incidents/Queue/Map tabs. *Fix:* a composite default lens, or cross-link INC-205's "Open" to its ACT-95 queue item. → `/impeccable layout`

**[P3] SEV1 and SEV2 share the same critical-red badge** (`severityTone`). Text disambiguates (not color-alone), but a glanceable SEV1-vs-SEV2 distinction would aid triage ordering. *Fix:* accept + document, or give SEV2 a hollow/half-fill badge. → `/impeccable colorize`

**[P3] Banner / "N need you" navigation isn't announced to screen readers.** The lens switches but no `aria-live` cue. *Fix:* announce banner-triggered lens changes via the existing status region. → `/impeccable harden`

## Persona Red Flags
- **Alex (power user):** ✅ List sortable; Cmd+K; shortcuts; low-blast stays one-click. ❌ no bulk Queue actions; ❌ default-zoom canvas hides the open affordance.
- **Sam (a11y/SR):** ✅ much improved — `aria-sort`+announce on the spine, ack/resolve/approve announced, dialogs+Escape, full reduced-motion, Undo reachable. ❌ banner nav not announced; ❌ canvas open affordance L2-only (List path covers them → low severity).
- **On-call operator:** ✅ every fire actionable in-place; ✅ destructive approvals guarded+undoable; ✅ the thread answers "who can I trust with more autonomy" with evidence. ❌ still tab-hops the core loop.

## Minor Observations
The dossier's incident-record line is a genuinely honest gate signal (clean / trust withheld / live-fire proving logged) · approving Atlas's ACT-92 now also triggers a visible **demotion** with a ledger entry (the demotion drama the last critique wanted, at least partly) · the World invariants are reactive (`✗ 4.2` → `✓` after the burn cools) · the 6s Undo may be short for SR users to find — consider 8s or pause-on-focus · REMOVE OVERSIGHT still uses health-red on a non-health control (carried-over minor, defensible as max-danger).

## Questions to Consider
1. Reading and acting are both ~4-tier now — should the 9 lenses collapse into a **default cockpit + telescopes** rather than 9 equal peers?
2. Demotion is shown as a side-effect of a bad approval — should **losing trust** get its own dramatized beat the way promotion does?
3. The incident→promotion thread is a *scripted* causal chain — is "live-fire proving logged" credit too generous? How would an operator tell "earned trust" from "got lucky"?
