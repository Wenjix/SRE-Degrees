---
name: SRE Promotion Engine
description: A blueprint control room for operating fleets of autonomous SRE agents.
colors:
  bg: "#09090b"
  bg-soft: "#111113"
  surface: "#111113"
  surface-hover: "#1a1a1e"
  ink: "#ffffffe6"
  ink-secondary: "#a1a1aa"
  ink-dim: "#ffffff9e"
  ink-muted: "#ffffff80"
  hairline: "#ffffff29"
  hairline-hover: "#ffffff42"
  accent: "#ededed"
  health-healthy: "#4ade80"
  health-degraded: "#fbbf24"
  health-critical: "#f87171"
  signal-blue: "#60a5fa"
typography:
  display:
    fontFamily: "Geist Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tnum"
  headline:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.16em"
  title:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "ss01, cv11, tnum"
  label:
    fontFamily: "Geist Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.1em"
rounded:
  none: "0px"
spacing:
  grid: "48px"
  hairline: "1px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 8px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "2px 7px"
  chip-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "2px 7px"
  card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
---

# Design System: SRE Promotion Engine

## 1. Overview

**Creative North Star: "The Blueprint Control Room"**

SRE Promotion Engine is a drafting-table blueprint you operate from a calm control room. The world is a 48px dot-grid plane; agents, services, incidents and the production estate are plotted on it as instruments, not cards. Structure is drawn with 1px hairlines and square corners; nothing is rounded, nothing is shadowed, nothing decorates. The surface stays deliberately quiet — a near-black field (`#09090b`) under mono readouts — so that the one thing allowed to be loud, **agent health**, is the only saturated color on screen. The operator reads the board the way an engineer reads a schematic: position carries meaning, type carries data, and color carries alarm.

It is dual-theme (a true light blueprint exists at `:root`), but dark is its face: a control room at 3am. Motion is reserved — a heartbeat on a degrading agent, a sonar ping on a critical one, a release pulse when an agent earns autonomy — never ambient decoration. Everything obeys `prefers-reduced-motion`.

This system explicitly rejects the **generic SaaS observability dashboard** (endless identical card grids, the hero-metric template, the cool-gray + single-accent monoculture of Datadog/Grafana), the **dark "hacker" cliché** (neon-on-black, matrix-rain, terminal-as-costume), **consumer/playful** friendliness (rounded shapes, bright multi-color, mascots), and **heavy enterprise** chrome (dense gray tables, Bootstrap/AdminLTE, modal-on-modal).

**Lineage — the interface has senses.** The system follows Amelia Wattenberger's thesis in *"Our interfaces have lost their senses"* and *"Evolving the infinite canvas"*: information should reach the operator through more than reading — peripheral vision, ambient warmth, motion, sound, and spatial memory. So health is never only a label. The board's `TemperatureField` warms toward the fire; a degrading agent's status dot *breathes* and a critical one *pings* outward as peripheral bait; the worst card physically lifts to win the visual fight; and an opt-in sonifier turns aggregate health into a low drone with panned earcons on every transition. Space is information too: agents live on a pannable, semantically-zoomed dot-grid world, clustered by proximity, where position carries meaning. Every sense is a **redundant** cue layered on the text — never the sole signal — and every one is silenced by `prefers-reduced-motion` (sound stays off until asked).

**Key Characteristics:**
- Square corners (`--ret-card-radius: 0`), 1px hairlines, zero shadows — flat by construction.
- Saturated color = agent health, and nothing else; the accent is an ink, never a hue.
- Mono data everywhere: numbers are tabular Geist Mono; labels are mono uppercase tracked.
- A 48px dot-grid "world" with drafting guides (rail/cross) as the spatial substrate.
- Calm by default; motion is a signal of real state change, always reduced-motion-gated.
- Ambient senses (after Wattenberger): temperature, breathing/sonar motion, and an opt-in sonifier as **redundant** health cues — never the sole signal.

## 2. Colors

A near-monochrome instrument field where the only saturated pigments are the four health states; everything else is ink on a dark blueprint.

### Primary
- **Blueprint Black** (`#09090b`): the body field — the dark control-room surface everything is plotted on. Light theme inverts to a near-white drafting paper (`#fbfbfb`).
- **Console Ink** (`#ededed`, the `accent`): a near-white ink (near-black `#18181b` in light theme), NOT a hue. Marks the active tab/chip, the primary action (Approve/Promote), and the monochrome autonomy fill. Its job is "this is live / do this" — never "this is a status."

### Neutral
- **Raised Surface** (`#111113` → `#1a1a1e` on hover): panels, rails, and code blocks layered one tonal step above the field. Depth is this tonal ladder, not shadow.
- **Ink / Ink-dim / Ink-muted** (`#ffffffe6` / `#ffffff9e` / `#ffffff80`): the text ramp — primary readouts, secondary data, and the quiet mono labels. All three clear AA on the dark field; muted is the floor, never lighter.
- **Hairline** (`#ffffff29`, hover `#ffffff42`): every border. 1px, never heavier. Plus drafting guides — grid (`#ffffff14`), rail, cross — that draw the world without weight.

### Health (the only saturated roles)
- **Healthy** (`#4ade80`): an agent (or owned service) within SLO.
- **Degraded** (`#fbbf24`): burning budget / elevated latency; recoverable.
- **Critical** (`#f87171`): on fire — the anchored alarm. Also the only red allowed in the code panels (a violated invariant, a `burnRate > 1`).
- Idle reuses **Ink-muted** (a non-color) — idle is absence of health, not a health state.

### Signal
- **Signal Blue** (`#60a5fa`): a sparse, non-health accent for affordances that are explicitly *not* status (e.g. a "live/new" marker, a link). Used rarely; it must never sit next to the health colors in a way that reads as a fifth state.

### Named Rules
**The One-Color-One-Meaning Rule.** Saturated color means agent health — full stop. It is *always* paired with a text label + a shape/position cue; status is never conveyed by color alone.

**The Ink-Accent Rule.** `--ret-accent` is an ink, not a hue. It carries "active / primary / autonomy," and must never be mistaken for a fifth status color.

**The Ink-Not-Hue Autonomy Rule.** Autonomy is encoded by left→right position + a monochrome ink fill bar + a chain/shackle icon + a mono label — never by color.

## 3. Typography

**Display / Data Font:** Geist Mono (with JetBrains Mono, `ui-monospace` fallback)
**Body / Heading Font:** Geist (with Inter, `system-ui` fallback)

**Character:** One family in two registers — Geist for prose and headers, Geist Mono for every number, label, and readout. The pairing reads as a precision instrument: humanist-neutral sans for language, monospace for data integrity. Base size is a dense `14px / 1.5`; `font-feature-settings: "ss01","cv11","tnum"` keeps figures tabular.

### Hierarchy
- **Display** (Geist Mono, 30px, weight 400, tabular): the headline metrics — fleet `$/hr`, modeled-estate headcount, blast counts. The only large type in the system; it's data, not decoration.
- **Headline** (Geist, 14px, weight 600, letter-spacing 0.16em, uppercase): the system markers — `RETICLE // SECTOR`, `FLEET · RISK & ECONOMICS`. Tracked, not big.
- **Title** (Geist, 13–15px, weight 600): agent names, incident titles, panel headers.
- **Body** (Geist, 14px, weight 400, 1.5): prose, reasoning lines, descriptions. Cap measure at 65–75ch.
- **Label** (Geist Mono, 9–10px, uppercase, letter-spacing 0.1em, ink-muted): the ubiquitous data labels, units, and column heads.

### Named Rules
**The Mono-Data Rule.** Every number is Geist Mono with `tabular-nums` so columns and live-ticking values never reflow. Labels and units are mono, uppercase, tracked, and muted — they recede so the value reads first.

## 4. Elevation

Flat by default. Depth is built from three flat devices: **1px hairlines** that separate every region, a **tonal ladder** (`bg #09090b` → `bg-soft/surface #111113` → `surface-hover #1a1a1e`) that lifts panels one step at a time, and the **48px dot-grid + drafting guides** that give the world a measured ground. The ambient `TemperatureField` warms the whole board by aggregate fleet health — atmosphere, not a drop shadow.

There is exactly **one** shadow in the system, and it is a *response to state*, never ambient: the worst card in view (a critical agent) lifts `translateY(-4px)` with a soft accent-glow (`box-shadow: 0 14px 36px var(--ret-accent-glow)`) so the fire wins the visual fight. Elevation is earned by severity, not used for decoration.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest and stay flat. If you reach for a `box-shadow` to separate two things, use a hairline or a tonal step instead. The lone exception is the critical card's state-lift. Square corners only (`--ret-card-radius: 0`).

**The Senses Rule.** Health reaches the operator through redundant ambient channels — temperature (peripheral warmth), motion (a breathing dot, a sonar ping), and an opt-in sonifier (a 55Hz drone + panned earcons) — each layered on the text label, never replacing it. Every channel obeys `prefers-reduced-motion`; sound is off until the operator asks for it.

## 5. Components

Every control reads like console equipment: square, hairline-bordered, mono-labeled, instrument-grade and restrained.

### Buttons
- **Shape:** square (0 radius), 1px hairline or solid-ink fill; never rounded.
- **Primary** (Approve / Promote): solid `accent` ink background, `bg`-colored mono label, compact padding (`4px 10px`). Hover: `brightness(1.1)`.
- **Ghost** (Deny / Escalate): transparent, 1px hairline, `ink-dim` mono label → `ink` on hover.
- **Focus:** `focus-visible:ring-2` in `accent` (1px ring on inputs). Never remove the focus indicator.

### Chips (filter / view tabs)
- **Style:** mono uppercase, square, no border at rest; `ink-dim` → `ink` on hover.
- **State:** active = solid `accent` background + `bg` text + `aria-pressed`/`aria-selected`. Counts ride as a small mono number; an urgent count is the lone exception that may take `health-critical`.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** `bg` for primary cards, `surface`/`bg-soft` for raised panels and code blocks.
- **Shadow Strategy:** none — see Elevation. Separation is the 1px hairline + tonal step.
- **Border:** 1px `hairline` → `hairline-hover` on hover. **Full borders only — never a side-stripe accent.**
- **Internal Padding:** 12px typical; dense readouts tighten to 8px.

### Inputs / Fields
- **Style:** transparent on a hairline-bordered container; mono or sans by context.
- **Focus:** `focus-visible` ring in `accent`; the outline is replaced, never removed.

### Navigation (the lens tab strip)
- One hairline-bordered strip of mono tabs over the shared store; active tab = `accent` fill, `role="tab"` + `aria-selected`. Count badges (Incidents/Queue) ride inline; urgent badges may take `health-critical`.

### Signature Components
- **Agent Card (Dedalus-grade machine card):** a square, hairline instrument tile. Health is the only color (a status dot + label + sparkline); work signals (actions / tool-ok / decision p95 / $/hr) and the owned service's burn read in mono. An `AutonomyChip` rides the footer.
- **AutonomyChip:** the single shared autonomy renderer — chain/shackle icon + monochrome ink fill bar + tier label + `RDY`. Color-free by rule.
- **Canvas instruments (globe / blast map / spatial board):** hand-rolled canvas-2D; health-colored nodes, ink selection rings, reduced-motion static frames, and a parallel screen-reader control list (the canvas is never the only path).
- **Promotion ceremonies (the launch track):** state changes are dramatized, not just toggled. Earning autonomy fires a one-shot **release pulse** (`ret-promote-pulse`, 900ms, in accent *ink* — never a health hue); the final REMOVE OVERSIGHT beat **dissolves the guardrail bracket** (`ret-bracket-dissolve`, 800ms) and **shatters the last chain link** (`ret-shatter`, 700ms); losing trust fires a **health ring** (`ret-health-ring`, 900ms, in the health color) and a reverse slide. Reduced-motion collapses each to an instant state change + an EvidenceLedger entry + an `aria-live` announcement.
- **Sonifier (opt-in, off by default):** a 55Hz drone whose gain tracks aggregate fleet health, with discrete panned earcons on transitions — rising `[392, 523, 659]` for recovery/promotion, falling `[330, 247]` for degradation/demotion — panned by board position / autonomy tier. The mute toggle is the gesture that resumes the `AudioContext`. Sound is always a redundant cue, never the sole signal.

## 6. Do's and Don'ts

### Do:
- **Do** keep saturated color for agent health only (`#4ade80` / `#fbbf24` / `#f87171`), always paired with a text label and a shape/position cue.
- **Do** use `--ret-accent` as an ink for the active control, the primary action, and the autonomy fill — never as a status color.
- **Do** set every number in Geist Mono with `tabular-nums`; set labels in mono uppercase tracked and muted.
- **Do** separate regions with 1px hairlines and the tonal ladder (`bg` → `surface` → `surface-hover`); keep corners square.
- **Do** gate every animation behind `prefers-reduced-motion`, and give canvas surfaces a keyboard + screen-reader path (the List lens is the spine).
- **Do** treat motion, temperature, and sound as **redundant** ambient cues for health (Wattenberger's "senses") — reserved for genuine state change and always layered on the text label.

### Don't:
- **Don't** build the **generic SaaS dashboard**: no endless identical card grids, no hero-metric template (big number + small label + gradient), no cool-gray + single-accent monoculture. (Datadog/Grafana sameness is the thing to avoid.)
- **Don't** drift into the **dark "hacker" cliché** — no neon-on-black, no matrix-rain, no terminal-as-costume. Terminal-native typography is welcome; costume is not.
- **Don't** go **consumer/playful** (rounded friendly shapes, bright multi-color, mascots) or **heavy-enterprise** (dense gray tables, Bootstrap/AdminLTE chrome, modal-on-modal).
- **Don't** use `border-left`/`border-right` > 1px as a colored side-stripe on cards/list items/alerts. Full borders, tints, or leading marks instead.
- **Don't** use gradient text (`background-clip: text`), decorative glassmorphism, or any `box-shadow` for elevation.
- **Don't** convey status by color alone, and **don't** let `--ret-accent` or `signal-blue` read as a fifth health state.
- **Don't** round corners or introduce a second accent hue; square + ink is the system.
- **Don't** autoplay sound, animate for decoration, or let any single channel (color, motion, or sound) be the only carrier of a signal.
