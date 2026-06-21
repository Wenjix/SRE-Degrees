---
target: /dashboard
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-21T05-55-26Z
slug: app-dashboard-page-tsx
---
# Critique — Reticle Console `/dashboard`

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live counts/badges/SLA timers are excellent, but clicking a SEV1 incident silently selects the responder agent with no on-screen feedback |
| 2 | Match System / Real World | 4 | SRE vocabulary is exact and honest (burn rate, error budget, SEV1–3, IC, proving grounds, blast radius, MUTATE/READ) |
| 3 | User Control and Freedom | 2 | Escape closes dossiers, but Queue Approve is one-click + irreversible on prod MUTATE actions; no undo |
| 4 | Consistency and Standards | 3 | One shared AutonomyChip everywhere; but single-click-select / double-click-open is consistent yet non-obvious |
| 5 | Error Prevention | 2 | REMOVE OVERSIGHT is beautifully gated, but everyday destructive ops (Approve/Deny) have no guardrails — safety is hoarded at the dramatic moment |
| 6 | Recognition Rather Than Recall | 4 | Map legend explains every encoding; lenses labeled; filters + proving-ground positions visible |
| 7 | Flexibility and Efficiency | 2 | Cmd+K and header shortcuts are great, but the List lens (the triage spine) has no column sorting |
| 8 | Aesthetic and Minimalist Design | 4 | Exemplary restraint; calm-by-default discipline is real |
| 9 | Error Recovery | 2 | "IC unassigned" is honest but offers no recovery affordance; incident rows surface no next actions |
| 10 | Help and Documentation | 3 | Map legend + dossier self-document; no onboarding, and the click model is undiscoverable cold |
| **Total** | | **29/40** | **Good — strong foundation, sharp edges on control/error-prevention/efficiency** |

## Anti-Patterns Verdict

**Does this look AI-generated? Emphatically no** — the rare dashboard authored with a point of view.

**LLM assessment (design review):** Every absolute ban and project anti-reference was checked and cleared — no side-stripe borders, no gradient text, no glassmorphism-as-default, no hero-metric template (the large `$/hr` is flanked by dense peers — data, not vanity), no identical card grids, no eyebrow kickers, no cool-gray SaaS monoculture, no neon/matrix hacker costume. The Fleet "Correlated Authority," the blast-radius Map, and the causal-search-over-a-code-world-model are original, register-appropriate ideas that could not come from a template.

**Deterministic scan (detector):** `detect.mjs` over all 70 `.tsx`/`.css` files in `components/` + `app/` returned **exit 0, zero findings**. A manual pass confirmed it: every animation is `prefers-reduced-motion`-gated, every health color is paired with a text label, `tabular-nums` is applied throughout, and the `HealthSpine` 3px fill is a quantitative instrument (not a CSS side-stripe). **Where the detector beat the design review:** two ambient drop-shadows the slop-check waved through — `AgentDossier.tsx:87` (`-24px 0 80px rgba(0,0,0,.4)`) and `CommandPalette.tsx:131` (`0 24px 80px rgba(0,0,0,.35)`) — bend the project's own Flat-By-Default rule (they're monochrome so they don't trip the colored-glow detector, but the hairline borders already present make them redundant).

**Visual overlays:** the live detector overlay was intentionally skipped (single shared browser was in use by the design-review assessment); the deterministic CLI scan stands as the evidence.

## Overall Impression

Top-decile work against its own demanding bar. The autonomy model (position + ink, never hue), the "make the model honest" principle (live failing invariants, plain-language concentration risk), and accessibility (dialog roles, focusable canvas + parallel SR anchor lists, full reduced-motion coverage, opt-in sound) are genuinely implemented, not gestured at. The single biggest opportunity: **operability under pressure.** The console makes the fleet beautifully *legible* (4-tier reading) but only sparingly *operable* (2-tier acting) — the on-call cockpit is a dead-end, destructive approvals are unguarded, and the triage spine can't be sorted.

## What's Working

1. **The autonomy model is the product, rendered perfectly.** One shared `AutonomyChip` (chain→shackle→open→circle icon + monochrome ink fill + RDY) with zero saturated color, and the Promote lens arranging agents left→right by tier. The hardest invariant in the brief, nailed everywhere it appears.
2. **"Make the model honest" is real.** The World lens shows live invariants *failing* (`inv(w => maxBurn(w) <= 1) // ✗ 4.2`); the Fleet lens states concentration risk in plain words ("2 guarded+ agents can mutate core"). A healthy agent over a burning service reads as exactly that.
3. **Accessibility is built in.** Dialog roles + Escape, focusable canvas cards with rich `aria-label`, the World globe's parallel "Globe anchors" list, `<th scope>` tables, and every signature animation disabled under `prefers-reduced-motion`. WCAG-serious.

## Priority Issues

### [P1] The on-call cockpit is an action-less dead-end
- **What:** Clicking a SEV1 on the Incidents lens silently calls `select(agent)` + `focusZone()` (`components/sector/IncidentLens.tsx:45–51`) with no visible change and no Acknowledge / Assign IC / Open / Jump action. "IC unassigned" has no way to assign.
- **Why it matters:** PRODUCT.md's first success criterion is "what's on fire… in seconds." This is the 3am view, and its most important object responds to a click with nothing — it undercuts "calm-under-fire."
- **Fix:** Open an incident dossier (or inline expand) with the responder's live state, owned-service burn, and explicit actions (Acknowledge, Assign IC, Open agent dossier, Jump to Map); add an `aria-live` confirmation of the selection.
- **Suggested command:** `/impeccable clarify` (then `harden` for the actions)

### [P1] Destructive Queue actions are unguarded while the ceremony hoards all the safety
- **What:** Queue Approve/Deny are one-click + irreversible on prod MUTATE actions (no confirm, no undo); single-click on cards/rows also has side-effects. Meanwhile REMOVE OVERSIGHT gets a 1200ms hold.
- **Why it matters:** Error-prevention is wildly uneven — approving the wrong prod cert rotation during a SEV1 is high-consequence, yet frictionless. "Trust can be lost" should apply to approvals too.
- **Fix:** Add a 5–8s undo toast after Approve/Deny and an inline confirm for high-blast items (the data already carries blast/confidence); reserve the full hold ceremony for oversight removal.
- **Suggested command:** `/impeccable harden`

### [P2] The List lens (the keyboard/triage spine) cannot be sorted
- **What:** `ListLens.tsx` is a semantic table with static `<th>` — no `aria-sort`, no click-to-sort, fixed severity order.
- **Why it matters:** PRODUCT.md designates List as dense triage and the keyboard/SR spine. Power users and SR users can't re-rank by burn / EB / $/hr / readiness, and no sort is announced.
- **Fix:** Sortable header buttons with `aria-sort` (asc/desc/none), keyboard-operable, current sort announced via `aria-live`.
- **Suggested command:** `/impeccable layout`

### [P2] Select vs. open (single vs. double click) is undiscoverable
- **What:** Across Canvas + List, single-click selects, double-click opens the dossier — the deepest value in the product gated behind an unsignposted gesture (keyboard Enter works).
- **Why it matters:** Cold users click once, see selection, and assume that's all; they never reach the dossier.
- **Fix:** A hover hint ("↵ / dbl-click for dossier") or an "open" glyph on hover/selection; keep Enter.
- **Suggested command:** `/impeccable onboard`

### [P2] Flat-By-Default violation: ambient drop-shadows on the dossier panel + command palette
- **What:** `AgentDossier.tsx:87` and `CommandPalette.tsx:131` carry large monochrome drop-shadows; both already have hairline borders that are the design-system-correct separator. (Detector-confirmed; design review missed it.)
- **Why it matters:** DESIGN.md's Flat-By-Default rule allows exactly one shadow (the critical-card state-lift); these are decorative elevation.
- **Fix:** Remove the `shadow-[...]` classes; the `border` + bg contrast already separates the overlay.
- **Suggested command:** `/impeccable quieter`

## Persona Red Flags

**Alex (power user):** ❌ List can't be sorted (can't rank by burn/EB/cost). ❌ No bulk actions in Queue (one item at a time). ✅ Cmd+K + banner→Incidents + "N need you"→Queue are exactly right.

**Sam (accessibility / keyboard + SR):** ✅ Strong — dialog roles + Escape, focusable canvas, World globe anchor list, `<th scope>`, full reduced-motion, opt-in sound. ❌ List has no `aria-sort` on the lens explicitly designated as their spine. ❌ The incident-click side-effect has no `aria-live` announcement (silent to SR).

**On-call SRE operator (project persona):** ❌ The SEV1 is a dead-end click — can't Ack/Assign/act. ❌ One-click irreversible Approve during an active SEV1. ✅ All four PRODUCT.md questions (what's on fire / what needs me / who can I trust / what breaks) are reachable in seconds — the *reading* is excellent; the *acting* falls short.

## Minor Observations
- The final REMOVE OVERSIGHT confirm uses `--ret-red` (a health hue) for a non-health control — defensible as max-danger, but technically brushes "color = health only"; consider whether the hold-fill alone could carry it.
- Scatter lens has label collisions (Sweep/Cron/Reaper overlap) and no SLO reference line / quadrant labels — "position is meaning" is undercut without de-collision.
- `.ret-grain` noise film (opacity 0.025–0.055) is the closest thing to decoration in a system that claims "nothing decorates" — keep it deliberately low.
- At ~900px the sonifier/tab-strip clips at the right edge (desktop-first, low priority). Favicon 404 (cosmetic). Live data isn't persisted across reload (expected for a demo).

## Questions to Consider
1. Is Reticle a **read instrument or a control surface**? The reading is 4-tier, the acting is 2-tier — which does the on-call operator need more at 3am?
2. "Trust can be lost" — where is the **demotion drama from the operator's seat**? Promotion is ceremonious; is yanking autonomy equally legible?
3. Nine lenses as equal peers — should there be a default **"cockpit" composite** (incidents + queue + a blast peek) for the 3am workflow instead of tab-hopping?
4. Did the operator actually *decide* anything in Scatter/World, or are those the VP/demo telescope wearing operator clothes?
