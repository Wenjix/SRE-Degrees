# SRE-Degrees — Reticle Console

A spatial SRE operations console where autonomous agents are first-class, living
objects. **Seven lenses project one shared store.** Two are the hero surfaces:

1. **SECTOR** — a blueprint mission-control board where agents are Dedalus-grade
   cards arranged by service zone, with proximity grouping, semantic zoom, and a
   full sensory layer (motion + opt-in sonifier).
2. **The Promotion Engine** (`// PROMOTE`) — an "autonomy launch track" that
   visualizes an agent earning its way from **HARNESSED** (human-in-the-loop on
   every action) to **FULLY AUTONOMOUS** by accumulating verifiable evidence in
   progressively riskier proving environments. Trust is earned — and can be lost.

The rest turn that model into an operator's and a VP's working surfaces:

3. **On-call cockpit** — `// INCIDENTS` (the 3am triage view, severity-sorted)
   + `// QUEUE` (the human approval worklist that makes "human-in-the-loop" a
   real list, not a label). An active-incident banner + an "N need you" badge
   keep both one click away from any lens.
4. **VP telescope** — `// FLEET`, the Risk & Economics board read from orbit:
   spend + week-over-week, the oversight distribution, **correlated authority**
   (concentration risk), owner attribution, and the error-budget portfolio.
5. **Authority & Blast-Radius map** — `// MAP`: pick an agent and see the
   transitive blast of one bad call (`dependsOn × tools × tier × env`) and what
   oversight actually contains it.

> This README is written for AI agents working in the repo. It is a map +
> conventions reference, not marketing copy. Paths are relative to repo root.

---

## Quickstart

```bash
pnpm install
pnpm dev         # http://127.0.0.1:3220  (Next.js, --webpack)
pnpm typecheck   # next typegen && tsc --noEmit  (strict)
pnpm test        # node --test on lib/*  (pure logic only, no DOM)
pnpm build       # production build (--webpack)
```

The app boots at `/` → redirects to `/dashboard` (the SECTOR console).

---

## Tech stack (and hard constraints)

| | |
|---|---|
| Framework | **Next.js 16** (App Router) — builds/dev with **`--webpack`**, not Turbopack |
| UI | **React 19** |
| Language | **TypeScript** (`strict: true`; no `noUnusedLocals`) |
| Styling | **Tailwind CSS v4** (CSS-first: `@import "tailwindcss"` in `app/globals.css`; there is **no `tailwind.config`**) |
| Icons | **lucide-react** (the only icon source) |
| Package mgr | **pnpm** (`.npmrc` sets `store-dir=.pnpm-store` → a local, gitignored store) |
| Data | **Hardcoded** seed + a client-side telemetry simulator. No backend, no fetch, no auth. |

**NO NEW RUNTIME DEPENDENCIES.** Runtime deps are exactly: `next`, `react`,
`react-dom`, `lucide-react`. Everything else is hand-rolled (the camera,
clustering, charts, audio, state, animation). Do not add a graph/canvas/physics/
chart/audio/state library — match the existing hand-rolled patterns instead.

---

## Architecture at a glance

One store, many projections. `LensProvider` holds all state; every view is a
pure projection of it, so selection/data/autonomy stay coherent across lenses.

```
app/dashboard/page.tsx
  └─ <LensProvider>                      components/sector/LensProvider.tsx
       └─ <SectorWorkspace>              header: active-incident banner + "N need you" badge
            │                                    + FleetSummary + ViewModeSwitch + SoundToggle
            ├─ activeView "canvas"    → <SectorCanvas>   (spatial board, L1/L2 + drag)
            ├─ activeView "list"      → <ListLens>       (keyboard/SR triage table)
            ├─ activeView "scatter"   → <ScatterLens>    (latency × error-budget)
            ├─ activeView "promote"   → <PromoteLens>    (autonomy launch track)
            ├─ activeView "incidents" → <IncidentLens>   (active incidents, severity-sorted)
            ├─ activeView "queue"     → <QueueLens>      (agent actions awaiting human approval)
            ├─ activeView "fleet"     → <FleetLens>      (Risk & Economics board)
            ├─ activeView "blast"     → <BlastLens>      (authority + blast-radius map)
            ├─ rail: <GroupLedger> (canvas/scatter) | <EvidenceLedger> (promote)
            └─ overlay: <AgentDossier>  (L3 slide-over)
```

The store ticks a single `setInterval` (`stepTelemetry`, every 1600ms) that
mutates metrics, status, autonomy evidence, **and ages incidents + the approval
queue** — all immutably. **Do not add a second timer** — extend `stepTelemetry`.
The Fleet and Blast lenses derive everything live from `state.agents` via
`useMemo`; they add no state of their own.

---

## Directory map

```
app/
  globals.css            Design tokens (--ret-*), sensory @keyframes, reduced-motion block, grain
  layout.tsx             Root layout + theme boot script
  dashboard/page.tsx     Entry: <LensProvider><SectorWorkspace/>
  dashboard/layout.tsx   Wraps in <DashboardShell> (sidebar + header chrome)
  dashboard/projects|settings/   Legacy demo pages (still use lib/demo-data.ts)
  design-system/page.tsx Component showcase (incl. a SECTOR primitives section)

lib/
  sre-data.ts            DOMAIN MODEL: SreAgent type + ~14 seeded agents (work signals,
                         cost, owned service, eval/coverage) + Incident & PendingAction
                         types + seeds + zones[] + spatial constants (CELL=48, WORLD) +
                         autonomy seeds + fleetOverview + agentCommandEntities
  promotion.ts           PROMOTION ENGINE (pure, no React): TIERS, GATES, computeReadiness,
                         gateProgress, eligible, blockingReason, nextTier/prevTier
  fleet.ts               VP TELESCOPE (pure): fleetEconomics, fleetGovernance,
                         correlatedAuthority, ownershipRollup, budgetPortfolio +
                         FLEET_PRIOR_WEEK / TEAM_LEAD baselines
  blast.ts               BLAST RADIUS (pure): blastRadius (reverse-dependency BFS over
                         dependsOn × tools × tier × env) + topBlastRadii ranking
  navigation.ts          Nav sections, StatusTone + STATUS_TONE_CLASS, Cmd+K command builder
  demo-data.ts           Legacy DemoProject data (projects/settings pages only)
  cn.ts                  classnames join

components/sector/        THE PRODUCT. See "Core concepts".
  LensProvider.tsx       Store (context + useReducer), action creators, telemetry simulator
  SectorWorkspace.tsx    Top-level layout for the four lenses + rail + dossier
  SectorCanvas.tsx       Hand-rolled pan/zoom camera, drag-snap, keyboard traversal
  ZoneField.tsx          A named tier zone (EDGE/CORE/DATA/BATCH) on the board
  AgentCard.tsx          One renderer, L1 glyph tile / L2 full Dedalus card
  HealthSpine / ErrorBudgetArc / HeartbeatDot / ToolsRail / TerminalTail   card sub-parts
  ListLens / ScatterLens / GroupLedger / FleetSummary / ViewModeSwitch     other lenses + chrome
  IncidentLens.tsx       On-call: active incidents, severity→age sorted, burn sparkline
  QueueLens.tsx          On-call: human approval worklist (Approve/Deny/Escalate, SLA countdown)
  FleetLens.tsx          VP telescope: Economics / Oversight / Correlated authority / Ownership / Budget
  BlastLens.tsx          Authority & blast-radius SVG map (select origin → cascade highlight)
  AgentDossier.tsx       L3 detail slide-over (incl. a PROMOTION section)
  TemperatureField / HealthRing   ambient sensory overlays
  SoundToggle.tsx + useAmbientSound.ts   Web Audio sonifier (off by default)
  spatial.ts             snapToFreeCell (collision) + deriveGroups (proximity clustering)
  visual.ts              STATUS_COLOR_VAR, severity(), TOOL_ICON, burnFraction
  # promotion engine UI:
  PromoteLens.tsx        The launch track: tier lanes + tokens + ceremonies
  TierLane.tsx           One autonomy lane (header, meaning, fill legend, hatch texture)
  AutonomyChip.tsx       Shared autonomy renderer (icon + ink fill bar + label + RDY)
  GateCriterion.tsx      One verifiable criterion row
  ProvingStepper.tsx     sandbox → shadow → canary → production stepper
  CandidateDossier.tsx   Docked candidate inspector (trust meter + criteria + controls)
  PromoteControls.tsx    Promote / Hold / Roll back (+ hold-to-confirm REMOVE OVERSIGHT)
  EvidenceLedger.tsx     Auditable reverse-chron promotion log

components/reticle/       Low-level design primitives (ReticleFrame, ReticleCard, ReticleCross, …)
components/dashboard/     Shell chrome reused by SECTOR (DashboardShell, StatusHeader, CommandPalette, Sparkline, …)
components/ui/            Skeleton, BrailleSpinner

test/
  promotion.test.ts      Engine unit tests (readiness weighting, hard-cap, eligibility, gates)
  fleet.test.ts          Fleet derivations + guards on the seeded demo narrative
  blast.test.ts          Blast-radius BFS, containment, ranking (+ seeded-fleet assertions)
  navigation.test.ts     Nav/command tests
```
(`pnpm test` enumerates these explicitly — add new files to the `test` script in
`package.json`. Currently **33 tests** across 4 files; all pure, no DOM.)

---

## Core concepts

### 1. The Lens store — `components/sector/LensProvider.tsx`
`useLens()` returns `{ state, ...actions, worstStatus }`. State:
`agents`, `selectedId`, `openAgentId` (dossier), `activeView`, `focusZone`/`focusNonce`
(canvas framing intent), `soundOn`, `groupNames` (sticky cluster renames),
`promoteSelectedId`, `promotingId`/`demotingId` (transient ceremony flags), `ledger`,
plus the on-call cockpit's `incidents` + `pendingActions`. Actions include
`select`, `open`/`close`, `setView`, `focusZone`, `promote`/`hold`/`rollback`, and
`resolveAction(id, 'approve'|'deny'|'escalate')` (drops a queue item + logs it).
Action creators are stable (`useCallback([])`) so consumers don't re-bind every tick.
`stepTelemetry()` is where all live evolution happens (metrics + autonomy evidence +
incident/queue aging). The `selectedId` is shared, so picking an agent in the Blast
map or a Fleet callout re-roots every other lens to it.

### 2. SECTOR spatial board — `SectorCanvas.tsx`
- **Camera**: one `translate+scale` transform on a single wrapper, driven by a
  ref (no React re-render during pan). Pointer Events + wheel zoom + bounded pan.
- **Semantic zoom**: `scale < 0.78` → **L1** glyph tiles; else **L2** full cards.
  Clicking a zone frames it (L2). Double-click / Enter on a card opens **L3** dossier.
- **Position = meaning**: an agent's home zone (`SreAgent.zone`) is its service tier;
  drag a card → `snapToFreeCell` magnet-snaps to the nearest free 48px cell;
  `deriveGroups` re-derives proximity sub-clusters (`CORE/a`, `CORE/b`) live, shown in
  the `GroupLedger`. (Inspired by Wattenberger's infinite-canvas / proximity essays.)
- **Keyboard**: cards are focusable with arrow-key spatial traversal; the `ListLens`
  is the full keyboard/screen-reader path.

### 3. The Promotion Engine — `lib/promotion.ts` + `PromoteLens.tsx`
- **Tiers** (autonomy ladder): `harnessed → supervised → guarded → autonomous`.
  Position on the track = autonomy level.
- **Gates** (`GATES`): each promotion requires **8 verifiable** criteria —
  verified runs, **owned-service SLO** (fails if the service is burning, even when
  the agent is green), **decision-quality eval**, override-rate→0 (inverted),
  **review coverage** (the override denominator — a low correction rate is
  meaningless if little is reviewed), zero-criticals soak, dwell time, and
  proving-ground graduation (`sandbox→shadow→canary→production`). Targets ramp by tier.
- **Readiness** (`computeReadiness`): weighted 0–100, **slew-limited** so it creeps.
  Hits exactly 100 only when every criterion passes (= `eligible`). A critical
  **hard-caps readiness ≈60** → trust visibly collapses and can trigger auto-demote.
- **HITL ritual** (`PromoteControls`): Promote is disabled until `eligible()`
  (tooltip names the blocker via `blockingReason`). The final `guarded → autonomous`
  step is a deliberate **press-and-hold "REMOVE OVERSIGHT"**. Demotion is automatic
  on sustained-critical (with hysteresis + cooldown) or manual via Roll back.
- **Ceremonies** reuse the sensory layer: lane-slide (CSS transition), accent
  release pulse, bracket-dissolve + chain-shatter on the final promotion, health
  ring + falling earcon on demotion. Every event is appended to the `EvidenceLedger`.

### 4. Design language & sensory layer — `app/globals.css`
"Reticle": deep blueprint surface, 48px dot-grid + drafting guides, square corners
(`--ret-card-radius: 0`), 1px hairlines, mono data fonts, SVG grain overlay, dark + light.
Motion is CSS `@keyframes` (`ret-hb` heartbeat, `ret-sonar`, `ret-health-ring`,
`ret-promote-pulse`, `ret-bracket-dissolve`, `ret-shatter`) and the
**`TemperatureField`** that warms the board by aggregate health. Sound is native
**Web Audio** (`useAmbientSound`): OFF by default, the mute toggle is the gesture
that resumes the `AudioContext`; panned earcons on status + promote/demote events.

### 5. Operations & governance lenses (newer surfaces)
All four read the same store; none add a timer.
- **On-call cockpit** — `IncidentLens` (declared `Incident`s, sorted severity→age,
  with trend glyph, responders/IC, owned-service burn sparkline) and `QueueLens`
  (the `PendingAction` worklist, sorted overdue→mutating→largest-blast, with risk
  badge, blast radius, confidence, SLA countdown, and `resolveAction` controls).
  `SectorWorkspace` raises an active-incident banner (any SEV ≤ 2) + an
  "N need you" badge.
- **VP telescope** — `FleetLens` over `lib/fleet.ts`: spend + WoW, the autonomy
  ladder as a monochrome ink distribution, **correlated authority** (dependency
  hubs, autonomous-upstream, clustered mutate power), owner attribution, and the
  burning-vs-within-budget portfolio. "1 autonomous in production" is the headline
  governance number.
- **Authority & Blast-Radius map** — `BlastLens` over `lib/blast.ts`: an SVG of the
  spatial world (zones labelled with their service-criticality tier, `CORE·T0`).
  Node **shape** = authority (■ can mutate / ● read-only), **fill** = health,
  **inner ink** = autonomy, **dashed ring** = production; edges = `dependsOn`.
  Select an origin → its transitive downstream cascade lights up and the panel
  flags when blast exceeds oversight ("blast 6 at SUPERVISED — widen review").

### 6. Color discipline (important invariant)
**Saturated color (`--ret-green/amber/red/blue`) means exactly one thing: agent
HEALTH.** Status is never color-only (always paired with a dot + text label).
**Autonomy** is a separate, deliberately non-color language: lane **position** +
a monochrome **ink fill bar** + **hatch→solid texture** + a **chain/shackle icon**
+ a mono label — all in `AutonomyChip`. `--ret-accent` is an ink (not a hue) used
only for the Promote action and trust meter; it must never read as a 5th status.

---

## Domain model — `lib/sre-data.ts`

```ts
type SreAgent = {
  id; name; host; org; region;
  zone: 'edge'|'core'|'data'|'batch';              // service tier = board zone
  status: 'healthy'|'degraded'|'critical'|'idle';  tone: StatusTone;
  pos: {x,y};                                       // world coords, CELL-quantized
  slo: {burnRate,target};  errorBudget: {remainingPct};
  // --- agent-native work signals (golden signals for an AGENT, not a VM) ---
  actions; toolSuccess; decisionMs; cost: MetricSeries;  tokensPerMin;
  // the SERVICE this agent OWNS — its budget is INDEPENDENT of agent health
  service: {name, sloTarget, burnRate, errorBudgetPct};
  cpu|mem|disk: MetricSeries;                       // relegated host vitals (L3 only)
  latencyMs; heartbeat; tools; mcpServers; cron; dependsOn; terminalLines; uptime;
  // --- autonomy / promotion ---
  autonomyTier: 'harnessed'|'supervised'|'guarded'|'autonomous';
  readiness: number;                                // 0-100, recomputed + slew-limited
  provingEnv: 'sandbox'|'shadow'|'canary'|'production';
  verifiedRuns; successRate; overrideRate;
  evalPassRate; humanAgreementRate; reviewSamplingRate;  // decision quality + oversight integrity
  critsInWindow; soakMs; critStreak; cooldown;      // simulator bookkeeping
};

// on-call cockpit (lib/sre-data.ts)
type Incident = { id; severity:1|2|3|4; title; service; zones; customerImpact;
                  agentIds; trigger; burnTrend; lastAction; trend; commander; ageMs };
type PendingAction = { id; agentId; action; risk:'read'|'mutate'; blastServices;
                       blastInstances; blastScope; reasoning; confidence; ageMs; slaMs };
```

Seed narrative (the cast that makes each surface tell a story):
- **Atlas** — critical, harnessed, RDY ~22; owns a burning `control-plane-api` and
  is a dependency hub. The jailed cautionary tale.
- **Pan** — supervised, one criterion under the guarded gate. The promotion hero.
- **Hera** — guarded in production, primed for the REMOVE OVERSIGHT ceremony.
- **Hermes** — already autonomous in production, positionally upstream of the core.
  The "no human in any loop" governance + blast story.
- **Zeus** — a **healthy** agent sitting over a **burning** `payments-ledger`, barely
  reviewed (the agent/service split + the unwatched-gate fix).
- **Vela** — green but silently burning money ($52/hr runaway, the cost story).
- **Iris** — the **widest blast radius** in the fleet (6 agents) yet only supervised
  — under-watched for its reach. The credibility story on the Blast map.

---

## Conventions for agents working here

- **Indentation is TABS.** Match it.
- Imports use the **`@/`** alias (maps to repo root).
- Client components need `"use client"`. Pure logic (`lib/promotion.ts`,
  `lib/navigation.ts`) must stay React/DOM-free so `pnpm test` (node `--test`
  type-stripping) can import it — use **type-only** imports across the `@/` alias there.
- No `Date.now()`/`Math.random()` at **module scope** (SSR hydration); the seed is
  deterministic. Runtime randomness lives inside `stepTelemetry` (client effect only).
- Reuse before adding: tokens in `globals.css`, primitives in `components/reticle/`,
  `Sparkline` for charts, `AutonomyChip` for any autonomy display, `STATUS_COLOR_VAR`
  for health color.
- Every new animation goes in `globals.css` **and** into the `prefers-reduced-motion`
  block. Health/status must never be color-only.
- Verify changes with `pnpm typecheck && pnpm test && pnpm build`.

## Accessibility
`ListLens` is the keyboard + screen-reader spine (it carries AUTONOMY + RDY columns).
Canvas/track tokens are focusable with arrow traversal and `aria-label`s; the
promote lens announces tier changes via `aria-live`. `prefers-reduced-motion`
collapses every ceremony to an instant state change + ledger entry.

## Design references
Amelia Wattenberger — *"Our interfaces have lost their senses"* and *"Evolving the
infinite canvas"* (spatial cognition, ambient senses); Dedalus Labs machine-card UI
(the dark blueprint card aesthetic).

## Not yet built (intentional follow-ons)
Dependency edges inside the L3 dossier (the **Blast map** now carries them at the
fleet level), a minimap / off-screen edge-alert layer, persisted per-operator board
layouts, and a tuned demo "sim clock". The `/dashboard/projects` and
`/dashboard/settings` routes are legacy starter pages still backed by
`lib/demo-data.ts`.
