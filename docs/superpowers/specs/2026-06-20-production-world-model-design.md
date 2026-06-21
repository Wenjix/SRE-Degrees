# Production World Model — the `// WORLD` lens

**Status:** Design approved (brainstorm), pending implementation plan.
**Date:** 2026-06-20
**Surface:** A new 8th lens in the Reticle Console (`/dashboard`), over the existing `LensProvider` store.

---

## 1. Thesis

The console already shows the fleet *operating*. The World Model lens reframes it
from the agents' point of view: the fleet acts inside a **modeled production
estate**, and the **Causal Search Engine** distills any slice of that world into
the **code an agent plans against** — the project's "code world model" pitch made
literal and interactive.

It ties directly to the two papers Carter Wendelken (Google DeepMind) presented at
the Snorkel AI reading group:
- **Code World Models** — learn a full simulator and hand it to a planner → our
  **WORLD MODEL** code view (typed state + invariants + `step()`).
- **AutoHarness** — learn the smallest code patch that keeps the agent making
  valid moves → our **HARNESS** code view (legal-action filter + guards).

The lens lets the operator toggle between those two ends for any slice of the world.

Visual reference: a large point-cloud sphere ("Production World Model™", ~1.7M
nodes / 30 types) with a Causal Search Engine (filter chips + "ask a question") and
a right-hand details panel of node types + counts.

---

## 2. Decisions (from the brainstorm)

| # | Question | Decision |
|---|---|---|
| 1 | Scale vs honesty (14 real agents vs ~1.7M reference nodes) | **Hybrid** — real agents/services are labeled, interactive anchors; the surrounding estate is an explicitly *modeled* ambient cloud. |
| 2 | Code vs visualization | **Balanced** — the search engine bridges map ↔ code: a query both highlights the globe and emits the matching code slice. |
| 3 | Shape / register | **Rotating globe** (a "world model"; anchors sit legibly on the surface). |
| 4 | Layout | **Right rail toggles Types ↔ Code**: globe dominant, search bar over it, rail shows node-type counts by default and flips to the code slice on a query/selection. |
| 5 | Code-slice flavor | **Code World Model (typed state + invariants + `step()`)** as the hero, **plus a WORLD MODEL ↔ HARNESS toggle** (A↔B). |
| 6 | "Ask a question" fidelity | **Real lightweight parser** over the live store (no LLM/backend): intent grammar + fuzzy fallback. Never fabricates. |

---

## 3. Architecture & data flow

One store, one more projection. No new runtime dependencies; everything is
hand-rolled canvas / pure TS, consistent with the rest of `components/sector/`.

```
state.agents (live, ticked by stepTelemetry)
   │
   ├─ lib/world.ts        worldNodes(agents)  → sampled point set + real anchors
   │                      WORLD_TAXONOMY      → node types + deterministic counts
   │
   ├─ lib/world-query.ts  parseQuery(q, agents) + chip filter → QueryResult
   │                        (intent, title, focusAgentIds, typeFilter, summary)
   │                        reuses lib/blast.ts (depends-on/blast) + lib/fleet.ts
   │                        (burning/cost/autonomous)
   │
   └─ lib/world-code.ts   toWorldModel(result, agents) → code string
                          toHarness(result, agents)    → code string

components/sector/WorldLens.tsx        composes the three below; view-local state
  ├─ WorldGlobe.tsx     canvas-2D rotating globe; highlight = QueryResult.focus
  ├─ CausalSearch.tsx   chips + parser input (bottom-center, over the globe)
  └─ WorldCodePanel.tsx right rail: NODE TYPES ⇄ WORLD-AS-CODE (+ MODEL/HARNESS toggle)
```

**State ownership.** Query text, parsed `QueryResult`, active chip filter, and the
MODEL/HARNESS toggle are **view-local React state** (ephemeral, World-specific —
kept out of the global store). The cross-lens link stays `state.selectedId`:
selecting an anchor (or a query's focus agent) calls `select(id)`, which re-roots
Blast / Fleet / the dossier; arriving with an agent already selected pre-focuses
the globe on it.

**Timing.** Globe rotation is driven by a view-local `requestAnimationFrame` loop
(like the existing `SectorCanvas` camera), **not** a second store timer. The single
1600ms `stepTelemetry` TICK keeps agent health live, so the globe's anchor colors
update over time on their own.

---

## 4. Data model — `lib/world.ts` (pure, type-only imports, unit-tested)

```ts
export type WorldNodeType =
  | "agent" | "service" | "pod" | "container" | "vcpu" | "host"
  | "storage" | "deployment" | "ingress" | "loadbalancer" | "secret"
  | "function" | "etcd" | "operation";

export type WorldNode = {
  id: string;
  type: WorldNodeType;
  anchor: boolean;            // real, named, clickable (agents + services)
  agentId?: string;          // set on anchors → cross-lens select()
  status: AgentStatus;        // drives color (health-only)
  lat: number; lon: number;   // stable position on the unit sphere
};
```

**Taxonomy (`WORLD_TAXONOMY`)** — node type → modeled count. The 14 rows match the
`WorldNodeType` union exactly. Real types (`agent`, `service`) use the live fleet
size; the 12 ambient types are deterministic constants representing the estate the
fleet runs inside. The **headline count is the computed sum** — never hardcoded, so
it can't drift from the table.

| type | count | real? |
|---|---:|---|
| container | 382,487 | modeled |
| pod | 356,745 | modeled |
| vcpu | 353,241 | modeled |
| deployment | 196,723 | modeled |
| storage | 88,765 | modeled |
| ingress | 46,782 | modeled |
| secret | 43,222 | modeled |
| operation | 14,832 | modeled |
| host | 12,888 | modeled |
| loadbalancer | 9,420 | modeled |
| etcd | 6,214 | modeled |
| function | 4,020 | modeled |
| **agent** | **14** | **real** (from `state.agents`) |
| **service** | **14** | **real** (owned services) |

With these representative counts the headline sum is **≈1,515,367**; exact ambient
counts are finalized in the plan, and the headline is always computed from the
table (not a literal), so the displayed total stays consistent by construction.

**Anchors.** `worldNodes(agents)` emits one `agent` node per agent and one
`service` node per owned service, positioned at stable lat/lon (seeded from the
id, so they never wander between renders), carrying real health/status.

**Ambient sample.** The cloud renders a **representative ~1,700-point sample** of
the modeled estate (seeded RNG → deterministic, SSR-safe; no module-scope
`Math.random`/`Date.now`). The details panel shows the *true* modeled counts; the
sample is labeled honestly as a projection.

---

## 5. Rendering — `WorldGlobe.tsx`

- **Canvas 2D**, hand-rolled (no three.js / WebGL / deps). Precompute unit-sphere
  points once; each frame rotate around the Y axis by an advancing angle, project
  to 2D, depth-sort back-to-front, draw filled arcs.
- **Performance:** batch draw by the ~5 health colors (one `fillStyle` per group);
  depth → point size + alpha. ~1,700 points × 60fps is comfortable on the desktop
  demo target; cap is tunable.
- **Reduced motion:** `prefers-reduced-motion` → render a single static frame, no
  rAF loop (consistent with the project's motion policy).
- **Anchors:** larger dots with **billboarded** (screen-aligned) labels, hidden
  when the point faces away (z < 0). The **selected** agent's anchor gets the
  `--ret-accent` ring and is pulled toward the front.
- **Color = health only** (`STATUS_COLOR_VAR`), the same invariant as every lens.
  The accent ring is ink, never a 5th status.

---

## 6. Causal Search Engine — `lib/world-query.ts` (pure, unit-tested)

**Filter chips:** `All / Agent / Service / Pod / Host / Storage / Operation` —
selecting one isolates that node type in the globe and sets the rail context.

**Parser** `parseQuery(q: string, agents): QueryResult` — a small, honest intent
grammar over the live store:

| pattern | intent | source |
|---|---|---|
| `depends on X`, `blast of X`, `blast radius X` | downstream cascade of X | `lib/blast.ts` `blastRadius` |
| `what's burning`, `burning` | services with burnRate > 1 | `lib/fleet.ts` `budgetPortfolio` |
| `cost`, `spend`, `expensive` | top spenders | `lib/fleet.ts` `fleetEconomics` |
| `autonomous in prod`, `no human` | autonomous-in-production | `lib/fleet.ts` `fleetGovernance` |
| _(else)_ | fuzzy substring match over node names/types | `lib/world.ts` |

```ts
export type QueryResult = {
  intent: "depends" | "burning" | "cost" | "autonomy" | "filter" | "fallback";
  title: string;            // e.g. "Atlas → downstream"
  summary: string;          // one line shown above the code
  focusAgentIds: string[];  // globe highlight + the code slice's subjects
  typeFilter?: WorldNodeType;
};
```

The result drives **both** the globe highlight (focus set glows, rest dims) and the
generated code. Unrecognized input falls back to a name/type filter — it never
fabricates an answer.

---

## 7. Code panel — `lib/world-code.ts` (pure, unit-tested)

Two pure string generators over a `QueryResult` + the live agents:

- `toWorldModel(result, agents): string` → the **simulator** view: a typed
  `const world = { agents: {…}, services: {…} }` literal for the focus set,
  `inv(w => …)` invariants (owned-service `burnRate <= 1`; `reviewed(atlas)` when
  autonomous) annotated `✓`/`✗` from live values, and a `function step(w, action)`
  stub.
- `toHarness(result, agents): string` → the **minimal-patch** view:
  `legalActions(s)` filter + `apply(action)` guards (blast-instance cap, review
  coverage floor, burning-service block).

**Rail behavior.** Default = **NODE TYPES** (taxonomy counts, like the reference).
On a query/selection the rail switches its body to **WORLD AS CODE** with the
**WORLD MODEL ↔ HARNESS** toggle. Code is rendered **monochrome except where it
touches health** (a burning `burnRate: 4.2` / violated invariant is the only red) —
the color invariant holds even in the code panel. A copy-to-clipboard control is a
nice-to-have.

Generating plain strings (not React trees) makes both views trivially
unit-testable and deterministic.

---

## 8. Components & files

**New — `lib/`:**
- `world.ts` — `WorldNodeType`, `WORLD_TAXONOMY`, `worldNodes(agents)`, headline sum.
- `world-query.ts` — `parseQuery`, `QueryResult`, chip filters.
- `world-code.ts` — `toWorldModel`, `toHarness`.

**New — `components/sector/`:**
- `WorldLens.tsx` — root; owns view-local query/filter/toggle state; composes the three.
- `WorldGlobe.tsx` — the canvas-2D rotating globe.
- `CausalSearch.tsx` — chips + parser input (over the globe, bottom-center).
- `WorldCodePanel.tsx` — the right rail (NODE TYPES ⇄ code + MODEL/HARNESS toggle).

**Edited:**
- `LensProvider.tsx` — add `ViewMode "world"`.
- `ViewModeSwitch.tsx` — add the World tab (lucide `Globe`).
- `SectorWorkspace.tsx` — render `WorldLens` for `view === "world"` (full-bleed, no rail).
- `package.json` — add `test/world.test.ts` to the `test` script.

**Reuses:** `lib/blast.ts`, `lib/fleet.ts`, `STATUS_COLOR_VAR`, the seeded `series`/RNG pattern.

---

## 9. Design invariants (must hold)

- **No new runtime dependencies.** Canvas-2D + pure TS only.
- **Color = health only.** Globe nodes, anchors, and the code panel's red all mean
  health; the accent ring is ink.
- **One store timer.** Rotation is view-local rAF; no second `setInterval`.
- **Reduced motion** collapses rotation to a static frame.
- **SSR-safe determinism.** No module-scope `Date.now()` / `Math.random()`; seeded RNG.
- **TABS indentation, `@/` alias, `"use client"` on components, type-only imports in `lib/`.**

---

## 10. Build sequence

1. `lib/world.ts` + taxonomy + `worldNodes` + `test/world.test.ts` (counts/anchors).
2. `lib/world-query.ts` (parser intents + fallback) + tests.
3. `lib/world-code.ts` (`toWorldModel` / `toHarness`) + tests.
4. `WorldGlobe.tsx` (static frame first, then rAF rotation + reduced-motion).
5. `CausalSearch.tsx` + `WorldCodePanel.tsx`.
6. `WorldLens.tsx` wiring + ViewMode + tab + workspace render.
7. Verify: `pnpm typecheck && pnpm test && pnpm build`, then Playwright DOM check.

---

## 11. Testing & verification

- **Unit (`test/world.test.ts`, node --test):** taxonomy counts sum to the headline;
  `worldNodes` emits the right anchor count and stable positions; `parseQuery`
  resolves each intent + the fuzzy fallback; `toWorldModel`/`toHarness` contain the
  expected entities/invariants and flag live health values.
- **Types/build:** `pnpm typecheck` + `pnpm build` clean.
- **Browser (Playwright):** World tab renders the globe; chips filter; a query
  ("what depends on Atlas?") highlights the focus set and the rail shows the code
  slice; the MODEL↔HARNESS toggle swaps the code; selecting an anchor re-roots the
  Blast lens.

---

## 12. Non-goals / deferred

- No real LLM / NL understanding beyond the intent grammar + fuzzy match.
- No 3D/WebGL, no edges drawn between cloud points (the Blast map owns dependency edges).
- No persistence of queries; no per-node drill-down for ambient (non-anchor) nodes.
- The ambient estate is explicitly *modeled*, not claimed real infrastructure.

## 13. Risks

- **Canvas perf** at high point counts → mitigated by color-batching + a tunable cap.
- **"Modeled" honesty** → the estate card and details panel must read as a model,
  with the 14 real agents/services clearly the only interactive, real anchors.
- **Scope** → the MODEL↔HARNESS toggle is the one deliberate extra beyond the
  reference; everything else maps 1:1 to a reviewed decision above.
