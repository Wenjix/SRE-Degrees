# Production World Model (`// WORLD` lens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an 8th lens to SRE Promotion Engine — a rotating, health-colored globe of a modeled production estate with a Causal Search Engine that distills any slice into the code an agent plans against (WORLD MODEL ↔ HARNESS).

**Architecture:** Three pure, node-tested `lib/world*.ts` modules (taxonomy + sampled nodes; intent parser; code generators) feed four client components (`WorldGlobe`, `CausalSearch`, `WorldCodePanel`, `WorldLens`) projected through the existing `LensProvider` store. Globe rotation is a view-local `requestAnimationFrame` loop; the single store TICK keeps health live.

**Tech Stack:** Next.js 16 (App Router, `--webpack`), React 19, TypeScript strict, Tailwind v4, lucide-react, canvas-2D (hand-rolled). Tests: `node --test` over `lib/` only.

## Global Constraints

- **NO new runtime dependencies** — only `next`, `react`, `react-dom`, `lucide-react`. Hand-rolled canvas-2D; no three.js/WebGL/graph/chart libs.
- **Color = health only.** Node/anchor/code colors come from `STATUS_COLOR_VAR` (healthy=green, degraded=amber, critical=red, idle=muted). The accent ring is ink (`--ret-accent`), never a 5th status. No blue.
- **One store timer.** Globe rotation is view-local `requestAnimationFrame`; do NOT add a second `setInterval` and do NOT extend `stepTelemetry` for this feature.
- **Reduced motion:** `prefers-reduced-motion: reduce` → render one static frame, no rAF loop.
- **SSR-safe determinism:** no `Date.now()` / `Math.random()` at module scope; use the seeded `mulberry32` PRNG defined in `lib/world.ts`.
- **Pure libs are type-only across `lib/`.** `lib/world*.ts` import from other `lib/` files with `import type` only (mirror small shared helpers inline, as `lib/blast.ts` already does) so `node --test` can type-strip them. Test files import sources **with the `.ts` extension**.
- **Conventions:** TABS for indentation; `@/` import alias; `"use client"` on components; lucide-react for icons.
- **Verify every component task:** `pnpm typecheck && pnpm build` clean; final task adds a Playwright DOM check.

---

### Task 1: `lib/world.ts` — taxonomy + sampled world nodes

**Files:**
- Create: `lib/world.ts`
- Create: `test/world.test.ts`
- Modify: `package.json` (add `test/world.test.ts` to the `test` script)

**Interfaces:**
- Consumes: `SreAgent`, `AgentStatus` (type-only) from `lib/sre-data.ts`.
- Produces: `WorldNodeType`, `WorldNode`, `TaxonomyRow`, `WORLD_TAXONOMY`, `worldNodes(agents, sample?)`, `taxonomyRows(agents)`, `worldHeadcount(agents)`.

- [ ] **Step 1: Write the failing test**

Create `test/world.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agents } from "../lib/sre-data.ts";
import { WORLD_TAXONOMY, taxonomyRows, worldHeadcount, worldNodes } from "../lib/world.ts";

describe("world taxonomy", () => {
	it("headcount = live agents + owned services + ambient counts", () => {
		const services = new Set(agents.map((a) => a.service.name)).size;
		const ambient = WORLD_TAXONOMY.reduce((s, t) => s + t.count, 0);
		assert.equal(worldHeadcount(agents), agents.length + services + ambient);
	});

	it("taxonomy rows pin real types first, then ambient by count desc", () => {
		const rows = taxonomyRows(agents);
		assert.equal(rows[0].type, "agent");
		assert.equal(rows[0].real, true);
		assert.equal(rows[1].type, "service");
		const ambient = rows.slice(2);
		for (let i = 1; i < ambient.length; i++) assert.ok(ambient[i - 1].count >= ambient[i].count);
	});
});

describe("world nodes", () => {
	it("emits an anchor per agent + per distinct owned service, plus the sample", () => {
		const services = new Set(agents.map((a) => a.service.name)).size;
		const nodes = worldNodes(agents, 500);
		assert.equal(nodes.filter((n) => n.type === "agent" && n.anchor).length, agents.length);
		assert.equal(nodes.filter((n) => n.type === "service" && n.anchor).length, services);
		assert.equal(nodes.filter((n) => !n.anchor).length, 500);
	});

	it("is deterministic (seeded) — same input, identical positions", () => {
		const a = worldNodes(agents, 50);
		const b = worldNodes(agents, 50);
		assert.deepEqual(a.map((n) => [n.id, n.lat, n.lon]), b.map((n) => [n.id, n.lat, n.lon]));
	});

	it("anchors carry real agent health; service anchors reflect burn", () => {
		const nodes = worldNodes(agents, 10);
		const atlas = nodes.find((n) => n.id === `agent:${agents.find((a) => a.name === "Atlas").id}`);
		assert.equal(atlas.status, "critical");
		const cpa = nodes.find((n) => n.id === "svc:control-plane-api");
		assert.equal(cpa.status, "critical"); // burnRate 4.2 > 3
	});
});
```

- [ ] **Step 2: Add the test file to the test script**

Modify `package.json` `scripts.test` to append ` test/world.test.ts`:

```json
"test": "node --test test/navigation.test.ts test/promotion.test.ts test/fleet.test.ts test/blast.test.ts test/world.test.ts"
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../lib/world.ts'`.

- [ ] **Step 4: Write `lib/world.ts`**

Create `lib/world.ts`:

```ts
// The modeled production estate that the fleet operates inside. Pure + node
// --test (type-only imports). The 14 real agents + their owned services are
// the interactive anchors; the rest is a seeded ambient sample standing in for
// a real deployment's pods/containers/vCPUs/etc.

import type { AgentStatus, SreAgent } from "./sre-data";

export type WorldNodeType =
	| "agent" | "service" | "pod" | "container" | "vcpu" | "host"
	| "storage" | "deployment" | "ingress" | "loadbalancer" | "secret"
	| "function" | "etcd" | "operation";

// modeled ambient estate (the 12 non-real types) — deterministic counts.
export const WORLD_TAXONOMY: { type: WorldNodeType; count: number }[] = [
	{ type: "container", count: 382_487 },
	{ type: "pod", count: 356_745 },
	{ type: "vcpu", count: 353_241 },
	{ type: "deployment", count: 196_723 },
	{ type: "storage", count: 88_765 },
	{ type: "ingress", count: 46_782 },
	{ type: "secret", count: 43_222 },
	{ type: "operation", count: 14_832 },
	{ type: "host", count: 12_888 },
	{ type: "loadbalancer", count: 9_420 },
	{ type: "etcd", count: 6_214 },
	{ type: "function", count: 4_020 },
];

export type WorldNode = {
	id: string;
	type: WorldNodeType;
	anchor: boolean; // real, named, clickable (agents + owned services)
	agentId?: string; // set on anchors → cross-lens select()
	status: AgentStatus; // drives color (health only)
	lat: number; // radians, -PI/2..PI/2
	lon: number; // radians, -PI..PI
};

export type TaxonomyRow = { type: WorldNodeType; count: number; real: boolean };

// deterministic PRNG + string hash (no module-scope randomness)
function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function latlon(u: number, v: number) {
	return { lat: Math.asin(2 * u - 1), lon: (2 * v - 1) * Math.PI };
}
const serviceStatus = (a: SreAgent): AgentStatus =>
	a.service.burnRate > 3 ? "critical" : a.service.burnRate > 1 ? "degraded" : "healthy";
const ambientStatus = (r: number): AgentStatus =>
	r < 0.82 ? "healthy" : r < 0.93 ? "degraded" : r < 0.965 ? "critical" : "idle";

function pickType(r: number): WorldNodeType {
	const total = WORLD_TAXONOMY.reduce((s, t) => s + t.count, 0);
	let x = r * total;
	for (const t of WORLD_TAXONOMY) if ((x -= t.count) <= 0) return t.type;
	return WORLD_TAXONOMY[0].type;
}

export function worldHeadcount(agents: SreAgent[]): number {
	const services = new Set(agents.map((a) => a.service.name)).size;
	return agents.length + services + WORLD_TAXONOMY.reduce((s, t) => s + t.count, 0);
}

export function taxonomyRows(agents: SreAgent[]): TaxonomyRow[] {
	const services = new Set(agents.map((a) => a.service.name)).size;
	const ambient = [...WORLD_TAXONOMY].sort((a, b) => b.count - a.count).map((t) => ({ ...t, real: false }));
	return [
		{ type: "agent", count: agents.length, real: true },
		{ type: "service", count: services, real: true },
		...ambient,
	];
}

export function worldNodes(agents: SreAgent[], sample = 1700): WorldNode[] {
	const nodes: WorldNode[] = [];
	for (const a of agents) {
		const r = mulberry32(hash(a.id));
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `agent:${a.id}`, type: "agent", anchor: true, agentId: a.id, status: a.status, lat, lon });
	}
	const seen = new Set<string>();
	for (const a of agents) {
		if (seen.has(a.service.name)) continue;
		seen.add(a.service.name);
		const r = mulberry32(hash(a.service.name));
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `svc:${a.service.name}`, type: "service", anchor: true, agentId: a.id, status: serviceStatus(a), lat, lon });
	}
	const r = mulberry32(0x5eed1e);
	for (let i = 0; i < sample; i++) {
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `amb:${i}`, type: pickType(r()), anchor: false, status: ambientStatus(r()), lat, lon });
	}
	return nodes;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — the `world taxonomy` and `world nodes` suites green, all prior suites still green.

- [ ] **Step 6: Commit**

```bash
git add lib/world.ts test/world.test.ts package.json
git commit -m "feat: lib/world.ts — modeled estate taxonomy + sampled world nodes"
```

---

### Task 2: `lib/world-query.ts` — the Causal Search Engine parser

**Files:**
- Create: `lib/world-query.ts`
- Modify: `test/world.test.ts` (append a `parseQuery` suite)

**Interfaces:**
- Consumes: `SreAgent` (type-only) from `lib/sre-data.ts`; `WorldNodeType` (type-only) from `lib/world.ts`.
- Produces: `QueryIntent`, `QueryResult`, `CHIP_TYPES`, `ChipType`, `parseQuery(q, agents)`, `chipFilter(chip)`.

- [ ] **Step 1: Write the failing test (append to `test/world.test.ts`)**

Append:

```ts
import { CHIP_TYPES, chipFilter, parseQuery } from "../lib/world-query.ts";

const id = (name: string) => agents.find((a) => a.name === name).id;

describe("causal search parser", () => {
	it("'what depends on Atlas?' → downstream cascade", () => {
		const r = parseQuery("what depends on Atlas?", agents);
		assert.equal(r.intent, "depends");
		assert.ok(r.focusAgentIds.includes(id("Atlas")));
		assert.ok(r.focusAgentIds.includes(id("Hera")));
		assert.ok(r.focusAgentIds.length >= 4); // Atlas + Nyx + Hera + Zeus
	});

	it("'what's burning' → services over budget", () => {
		const r = parseQuery("what's burning", agents);
		assert.equal(r.intent, "burning");
		assert.equal(r.typeFilter, "service");
		assert.ok(r.focusAgentIds.length >= 3);
	});

	it("'cost' → top spenders", () => {
		const r = parseQuery("highest cost", agents);
		assert.equal(r.intent, "cost");
		assert.equal(r.focusAgentIds.length, 3);
	});

	it("'autonomous in prod' → no-human-in-loop agents", () => {
		const r = parseQuery("autonomous in prod", agents);
		assert.equal(r.intent, "autonomy");
		assert.ok(r.focusAgentIds.includes(id("Hermes")));
	});

	it("unknown text → fuzzy fallback, never fabricates", () => {
		const hit = parseQuery("iris", agents);
		assert.equal(hit.intent, "fallback");
		assert.ok(hit.focusAgentIds.includes(id("Iris")));
		const miss = parseQuery("zzzz", agents);
		assert.equal(miss.intent, "fallback");
		assert.equal(miss.focusAgentIds.length, 0);
	});

	it("chip filter maps 'all' → null, type → itself", () => {
		assert.ok(CHIP_TYPES.includes("all"));
		assert.equal(chipFilter("all"), null);
		assert.equal(chipFilter("pod"), "pod");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../lib/world-query.ts'`.

- [ ] **Step 3: Write `lib/world-query.ts`**

Create `lib/world-query.ts`:

```ts
// The Causal Search Engine: filter chips + a small honest intent grammar over
// the live store. No LLM, no backend — it genuinely parses and never fabricates
// (unrecognized → name/type fallback). Type-only imports; reverse-dependency
// BFS is mirrored inline (as lib/blast.ts does) to stay node-testable.

import type { SreAgent } from "./sre-data";
import type { WorldNodeType } from "./world";

export type QueryIntent = "depends" | "burning" | "cost" | "autonomy" | "filter" | "fallback";

export type QueryResult = {
	intent: QueryIntent;
	title: string;
	summary: string;
	focusAgentIds: string[];
	typeFilter: WorldNodeType | null;
};

export const CHIP_TYPES = ["all", "agent", "service", "pod", "host", "storage", "operation"] as const;
export type ChipType = (typeof CHIP_TYPES)[number];

function downstream(agents: SreAgent[], originId: string): string[] {
	const dep = new Map<string, string[]>();
	for (const a of agents) for (const d of a.dependsOn) dep.set(d, [...(dep.get(d) ?? []), a.id]);
	const out = new Set<string>();
	let frontier = [originId];
	while (frontier.length) {
		const next: string[] = [];
		for (const cur of frontier)
			for (const c of dep.get(cur) ?? [])
				if (c !== originId && !out.has(c)) {
					out.add(c);
					next.push(c);
				}
		frontier = next;
	}
	return [...out];
}

const norm = (s: string) => s.toLowerCase().trim();
function findAgent(agents: SreAgent[], n: string): SreAgent | null {
	return (
		agents.find((a) => n.includes(a.name.toLowerCase())) ??
		agents.find((a) => n.includes(a.service.name.toLowerCase())) ??
		null
	);
}

export function parseQuery(q: string, agents: SreAgent[]): QueryResult {
	const n = norm(q);
	if (!n) return { intent: "filter", title: "All entities", summary: "The full modeled estate.", focusAgentIds: [], typeFilter: null };

	if (/\b(depends?|blast|downstream|cascade)\b/.test(n)) {
		const a = findAgent(agents, n);
		if (a) {
			const ids = downstream(agents, a.id);
			return { intent: "depends", title: `${a.name} → downstream`, summary: `${ids.length} agents depend on ${a.name}.`, focusAgentIds: [a.id, ...ids], typeFilter: null };
		}
	}
	if (/\b(burn|burning|budget|slo)\b/.test(n)) {
		const ids = agents.filter((a) => a.service.burnRate > 1).map((a) => a.id);
		return { intent: "burning", title: "Burning services", summary: `${ids.length} owned services over budget.`, focusAgentIds: ids, typeFilter: "service" };
	}
	if (/\b(cost|spend|spending|expensive|money)\b/.test(n) || n.includes("$")) {
		const ids = [...agents].sort((a, b) => b.cost.current - a.cost.current).slice(0, 3).map((a) => a.id);
		return { intent: "cost", title: "Top spend", summary: "The 3 most expensive agents.", focusAgentIds: ids, typeFilter: "agent" };
	}
	if (/\b(autonom|no human|unsupervised)\b/.test(n)) {
		const ids = agents.filter((a) => a.autonomyTier === "autonomous").map((a) => a.id);
		return { intent: "autonomy", title: "Autonomous agents", summary: `${ids.length} agents act with no human in the loop.`, focusAgentIds: ids, typeFilter: "agent" };
	}
	const matches = agents.filter((a) => norm(a.name).includes(n) || norm(a.service.name).includes(n));
	if (matches.length) return { intent: "fallback", title: `Matches for "${q}"`, summary: `${matches.length} entities match.`, focusAgentIds: matches.map((a) => a.id), typeFilter: null };
	return { intent: "fallback", title: `No match for "${q}"`, summary: "No entities matched — showing the full estate.", focusAgentIds: [], typeFilter: null };
}

export function chipFilter(chip: ChipType): WorldNodeType | null {
	return chip === "all" ? null : (chip as WorldNodeType);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — the `causal search parser` suite green.

- [ ] **Step 5: Commit**

```bash
git add lib/world-query.ts test/world.test.ts
git commit -m "feat: lib/world-query.ts — Causal Search Engine intent parser"
```

---

### Task 3: `lib/world-code.ts` — WORLD MODEL & HARNESS code generators

**Files:**
- Create: `lib/world-code.ts`
- Modify: `test/world.test.ts` (append a code-gen suite)

**Interfaces:**
- Consumes: `SreAgent` (type-only) from `lib/sre-data.ts`; `QueryResult` (type-only) from `lib/world-query.ts`.
- Produces: `toWorldModel(result, agents)`, `toHarness(result, agents)` — both return `string`.

- [ ] **Step 1: Write the failing test (append to `test/world.test.ts`)**

Append:

```ts
import { toHarness, toWorldModel } from "../lib/world-code.ts";

describe("world-as-code generators", () => {
	const atlas = parseQuery("depends on Atlas", agents);

	it("WORLD MODEL emits typed state, the owned service, and a violated invariant", () => {
		const code = toWorldModel(atlas, agents);
		assert.match(code, /const world = \{/);
		assert.match(code, /control-plane-api/);
		assert.match(code, /burnRate: 4\.2/);
		assert.match(code, /✗/); // burn 4.2 > 1 violates the SLO invariant
		assert.match(code, /function step\(w, action\)/);
	});

	it("HARNESS emits a legal-action filter and guards", () => {
		const code = toHarness(atlas, agents);
		assert.match(code, /function legalActions/);
		assert.match(code, /reviewSamplingRate >= 0\.05/);
		assert.match(code, /return block\(a\)/); // control-plane-api is burning
	});

	it("falls back to the first agents when a query has no focus", () => {
		const empty = parseQuery("zzzz", agents);
		const code = toWorldModel(empty, agents);
		assert.match(code, /const world = \{/);
		assert.ok(code.split("\n").length > 5);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../lib/world-code.ts'`.

- [ ] **Step 3: Write `lib/world-code.ts`**

Create `lib/world-code.ts`:

```ts
// "World as code": turn a query slice into the artifact an agent plans against.
// toWorldModel = the simulator (Code World Models); toHarness = the minimal
// guard (AutoHarness). Pure string builders → deterministic + node-testable.

import type { SreAgent } from "./sre-data";
import type { QueryResult } from "./world-query";

function subjects(result: QueryResult, agents: SreAgent[]): SreAgent[] {
	const ids = result.focusAgentIds.length ? result.focusAgentIds : agents.slice(0, 3).map((a) => a.id);
	return ids.map((id) => agents.find((a) => a.id === id)).filter((a): a is SreAgent => !!a);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function toWorldModel(result: QueryResult, agents: SreAgent[]): string {
	const subs = subjects(result, agents);
	const nameOf = (id: string) => slug(agents.find((x) => x.id === id)?.name ?? id);
	const agentLines = subs
		.map((a) => `    ${slug(a.name)}: { tier: ${JSON.stringify(a.autonomyTier)}, owns: ${JSON.stringify(a.service.name)}, dependsOn: ${JSON.stringify(a.dependsOn.map(nameOf))} },`)
		.join("\n");
	const svc = new Map<string, SreAgent>();
	for (const a of subs) if (!svc.has(a.service.name)) svc.set(a.service.name, a);
	const svcLines = [...svc.values()]
		.map((a) => `    ${JSON.stringify(a.service.name)}: { sloTarget: ${a.service.sloTarget}, burnRate: ${a.service.burnRate}, budgetPct: ${a.service.errorBudgetPct} },`)
		.join("\n");
	const worstBurn = subs.reduce((m, a) => Math.max(m, a.service.burnRate), 0);
	const unreviewedAuton = subs.some((a) => a.autonomyTier === "autonomous" && a.reviewSamplingRate < 0.05);
	return [
		`// world slice · ${result.title}`,
		`const world = {`,
		`  agents: {`,
		agentLines,
		`  },`,
		`  services: {`,
		svcLines,
		`  },`,
		`};`,
		``,
		`// invariants the planner must preserve`,
		`inv(w => maxBurn(w) <= 1)   // ${worstBurn <= 1 ? "✓" : `✗ ${worstBurn}`}`,
		`inv(w => reviewed(w) || !autonomous(w))   // ${unreviewedAuton ? "✗" : "✓"}`,
		``,
		`function step(w, action) { /* next world */ }`,
	].join("\n");
}

export function toHarness(result: QueryResult, agents: SreAgent[]): string {
	const subs = subjects(result, agents);
	const burning = subs.find((a) => a.service.burnRate > 1)?.service.name ?? null;
	return [
		`// harness · ${result.title} — minimal code that keeps the agent valid`,
		`function legalActions(s) {`,
		`  return ALL.filter(a =>`,
		`    !mutatesProd(a) || s.reviewSamplingRate >= 0.05);   // coverage guard`,
		`}`,
		``,
		`function apply(a) {`,
		`  if (a.risk === "mutate" && a.blastInstances > 8) return needsHuman(a);`,
		burning ? `  if (burning(${JSON.stringify(burning)})) return block(a);   // over budget` : `  // no burning owned service in this slice`,
		`  return commit(a);`,
		`}`,
	].join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — `world-as-code generators` green; full suite count rises.

- [ ] **Step 5: Commit**

```bash
git add lib/world-code.ts test/world.test.ts
git commit -m "feat: lib/world-code.ts — WORLD MODEL + HARNESS code generators"
```

---

### Task 4: `WorldGlobe.tsx` — the rotating canvas-2D globe

**Files:**
- Create: `components/sector/WorldGlobe.tsx`

**Interfaces:**
- Consumes: `WorldNode` (type-only) from `lib/world.ts`; `STATUS_COLOR_VAR` from `./visual` (CSS-var names — resolved to concrete colors at draw time via `getComputedStyle`).
- Produces: `<WorldGlobe nodes focusIds selectedId onPick />` where `onPick(agentId: string)` fires when an anchor is clicked.

- [ ] **Step 1: Write `components/sector/WorldGlobe.tsx`**

Create `components/sector/WorldGlobe.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

import type { AgentStatus } from "@/lib/sre-data";
import type { WorldNode } from "@/lib/world";

const STATUS_VAR: Record<AgentStatus, string> = {
	healthy: "--ret-green",
	degraded: "--ret-amber",
	critical: "--ret-red",
	idle: "--ret-text-muted",
};

// Hand-rolled canvas globe. Points live on a unit sphere (lat/lon); each frame
// rotates around the Y axis, projects to 2D, depth-sorts, and draws. Rotation is
// a view-local rAF loop (NOT a store timer); reduced-motion renders one frame.
export function WorldGlobe({
	nodes,
	focusIds,
	selectedId,
	onPick,
}: {
	nodes: WorldNode[];
	focusIds: Set<string>;
	selectedId: string | null;
	onPick: (agentId: string) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hitsRef = useRef<{ agentId: string; x: number; y: number; z: number }[]>([]);
	// keep latest props for the animation loop without re-subscribing
	const stateRef = useRef({ nodes, focusIds, selectedId });
	stateRef.current = { nodes, focusIds, selectedId };

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const root = document.documentElement;
		const cssVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim() || "#888";
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let raf = 0;
		let angle = 0;
		let w = 0;
		let h = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);

		const draw = () => {
			const { nodes: ns, focusIds: focus, selectedId: sel } = stateRef.current;
			const cx = w * 0.5;
			const cy = h * 0.5;
			const R = Math.min(w, h) * 0.42;
			const colors: Record<AgentStatus, string> = {
				healthy: cssVar(STATUS_VAR.healthy),
				degraded: cssVar(STATUS_VAR.degraded),
				critical: cssVar(STATUS_VAR.critical),
				idle: cssVar(STATUS_VAR.idle),
			};
			const accent = cssVar("--ret-accent");
			const text = cssVar("--ret-text");
			const dim = cssVar("--ret-text-dim");
			ctx.clearRect(0, 0, w, h);

			const sin = Math.sin(angle);
			const cos = Math.cos(angle);
			const active = focus.size > 0;
			const projected = ns.map((n) => {
				const cl = Math.cos(n.lat);
				const x0 = cl * Math.sin(n.lon);
				const y0 = Math.sin(n.lat);
				const z0 = cl * Math.cos(n.lon);
				const x = x0 * cos + z0 * sin;
				const z = -x0 * sin + z0 * cos;
				return { n, x: cx + x * R, y: cy - y0 * R, z };
			});
			projected.sort((a, b) => a.z - b.z);

			const hits: typeof hitsRef.current = [];
			for (const p of projected) {
				const depth = (p.z + 1) / 2;
				const isFocus = active && p.n.agentId != null && focus.has(p.n.agentId);
				const dim2 = active && !isFocus && !p.n.anchor;
				if (p.n.anchor) {
					const r = 4.5 + depth * 2.5;
					ctx.globalAlpha = 0.3 + depth * 0.7;
					ctx.fillStyle = colors[p.n.status];
					ctx.beginPath();
					ctx.arc(p.x, p.y, r, 0, 7);
					ctx.fill();
					if (p.n.agentId === sel || isFocus) {
						ctx.globalAlpha = 1;
						ctx.strokeStyle = accent;
						ctx.lineWidth = p.n.agentId === sel ? 2.5 : 1.5;
						ctx.beginPath();
						ctx.arc(p.x, p.y, r + 4, 0, 7);
						ctx.stroke();
					}
					// billboard label only when facing the viewer
					if (p.z > 0.1) {
						ctx.globalAlpha = 0.4 + depth * 0.6;
						ctx.fillStyle = isFocus || p.n.agentId === sel ? text : dim;
						ctx.font = "11px ui-monospace, monospace";
						ctx.fillText(p.n.id.replace(/^(agent|svc):/, ""), p.x + r + 4, p.y + 3);
					}
					if (p.n.agentId && p.z > -0.2) hits.push({ agentId: p.n.agentId, x: p.x, y: p.y, z: p.z });
				} else {
					ctx.globalAlpha = (dim2 ? 0.06 : 0.16) + depth * (dim2 ? 0.06 : 0.5);
					ctx.fillStyle = colors[p.n.status];
					ctx.beginPath();
					ctx.arc(p.x, p.y, 0.6 + depth * 1.6, 0, 7);
					ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
			hitsRef.current = hits;
		};

		const loop = () => {
			angle += 0.0016;
			draw();
			raf = requestAnimationFrame(loop);
		};
		if (reduce) draw();
		else raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, []);

	const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const py = e.clientY - rect.top;
		let best: { agentId: string; d: number } | null = null;
		for (const hit of hitsRef.current) {
			const d = Math.hypot(hit.x - px, hit.y - py);
			if (d < 16 && (!best || d < best.d)) best = { agentId: hit.agentId, d };
		}
		if (best) onPick(best.agentId);
	};

	return <canvas ref={canvasRef} onClick={handleClick} className="h-full w-full cursor-pointer" aria-label="Production world model globe" />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors). If `React.MouseEvent` is unresolved, confirm the file has `"use client"` and that React types are available (they are, project-wide).

- [ ] **Step 3: Commit**

```bash
git add components/sector/WorldGlobe.tsx
git commit -m "feat: WorldGlobe — hand-rolled canvas-2D rotating globe"
```

---

### Task 5: `CausalSearch.tsx` + `WorldCodePanel.tsx`

**Files:**
- Create: `components/sector/CausalSearch.tsx`
- Create: `components/sector/WorldCodePanel.tsx`

**Interfaces:**
- `CausalSearch`: Consumes `CHIP_TYPES`, `ChipType` from `lib/world-query.ts`. Produces `<CausalSearch chip onChip query onQuery />` where `onChip(chip: ChipType)` and `onQuery(text: string)` fire on chip click / Enter.
- `WorldCodePanel`: Consumes `taxonomyRows`, `TaxonomyRow` from `lib/world.ts`; `QueryResult` from `lib/world-query.ts`; `toWorldModel`/`toHarness` from `lib/world-code.ts`; `SreAgent` (type) from `lib/sre-data.ts`. Produces `<WorldCodePanel agents result headcount />`.

- [ ] **Step 1: Write `components/sector/CausalSearch.tsx`**

Create `components/sector/CausalSearch.tsx`:

```tsx
"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { CHIP_TYPES, type ChipType } from "@/lib/world-query";

// The Causal Search Engine bar: type filter chips + a real parser input. Sits
// over the globe, bottom-center (faithful to the reference).
export function CausalSearch({
	chip,
	onChip,
	onQuery,
}: {
	chip: ChipType;
	onChip: (c: ChipType) => void;
	onQuery: (text: string) => void;
}) {
	const [text, setText] = useState("");
	return (
		<div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(560px,88%)] -translate-x-1/2 border border-[var(--ret-border)] bg-[var(--ret-bg)]/70 backdrop-blur-sm">
			<div className="flex flex-wrap gap-1 p-2">
				{CHIP_TYPES.map((c) => (
					<button
						key={c}
						type="button"
						onClick={() => onChip(c)}
						className={cn(
							"px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
							c === chip ? "bg-[var(--ret-accent)] text-[var(--ret-bg)]" : "text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
						)}
					>
						{c}
					</button>
				))}
			</div>
			<form
				className="flex items-center gap-2 border-t border-[var(--ret-border)] px-2.5 py-2"
				onSubmit={(e) => {
					e.preventDefault();
					onQuery(text);
				}}
			>
				<Search className="h-3.5 w-3.5 shrink-0 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
				<input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="ask: what depends on Atlas? · what's burning? · cost"
					className="w-full bg-transparent font-mono text-[12px] text-[var(--ret-text)] placeholder:text-[var(--ret-text-muted)] focus:outline-none"
					aria-label="Causal search"
				/>
			</form>
		</div>
	);
}
```

- [ ] **Step 2: Write `components/sector/WorldCodePanel.tsx`**

Create `components/sector/WorldCodePanel.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { SreAgent } from "@/lib/sre-data";
import { taxonomyRows } from "@/lib/world";
import { toHarness, toWorldModel } from "@/lib/world-code";
import type { QueryResult } from "@/lib/world-query";

import { STATUS_COLOR_VAR } from "./visual";

const grp = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Render a generated code string monochrome-except-health: a line carrying ✗ or
// a burn value shows its trailing comment in the critical (health) color.
function CodeBlock({ code }: { code: string }) {
	return (
		<pre className="flex-1 overflow-auto whitespace-pre px-3 py-2.5 font-mono text-[11.5px] leading-[1.55] text-[var(--ret-text-dim)]">
			{code.split("\n").map((line, i) => {
				const hot = line.includes("✗") || /burnRate: [1-9]/.test(line);
				return (
					<div key={i} style={hot ? { color: STATUS_COLOR_VAR.critical } : undefined}>
						{line || " "}
					</div>
				);
			})}
		</pre>
	);
}

export function WorldCodePanel({ agents, result, headcount }: { agents: SreAgent[]; result: QueryResult | null; headcount: number }) {
	const [view, setView] = useState<"model" | "harness">("model");
	const rows = useMemo(() => taxonomyRows(agents), [agents]);
	const code = useMemo(() => {
		if (!result) return null;
		return view === "model" ? toWorldModel(result, agents) : toHarness(result, agents);
	}, [result, agents, view]);

	return (
		<aside className="flex w-[330px] shrink-0 flex-col border-l border-[var(--ret-border)] bg-[var(--ret-bg)]">
			<div className="border-b border-[var(--ret-border)] px-3 py-2.5">
				<div className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Modeled production estate</div>
				<div className="mt-0.5 font-mono text-[18px] tabular-nums">{grp(headcount)}</div>
				<div className="font-mono text-[10px] text-[var(--ret-text-muted)]">entities · {rows.length} node types</div>
			</div>

			{result && code ? (
				<>
					<div className="flex items-center justify-between gap-2 border-b border-[var(--ret-border)] px-3 py-2">
						<span className="truncate font-mono text-[11px] text-[var(--ret-text)]">{result.title}</span>
						<div className="flex shrink-0 border border-[var(--ret-border)]">
							{(["model", "harness"] as const).map((m) => (
								<button
									key={m}
									type="button"
									onClick={() => setView(m)}
									className={cn(
										"px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide transition-colors",
										view === m ? "bg-[var(--ret-accent)] text-[var(--ret-bg)]" : "text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
									)}
								>
									{m === "model" ? "World model" : "Harness"}
								</button>
							))}
						</div>
					</div>
					<CodeBlock code={code} />
				</>
			) : (
				<ul className="flex-1 overflow-y-auto px-3 py-2">
					{rows.map((r) => (
						<li key={r.type} className="flex items-center justify-between border-b border-[var(--ret-border)]/50 py-1 font-mono text-[11px]">
							<span className={r.real ? "text-[var(--ret-text)]" : "text-[var(--ret-text-dim)]"}>{r.type}</span>
							<span className="tabular-nums text-[var(--ret-text-muted)]">{grp(r.count)}</span>
						</li>
					))}
				</ul>
			)}
		</aside>
	);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/sector/CausalSearch.tsx components/sector/WorldCodePanel.tsx
git commit -m "feat: CausalSearch bar + WorldCodePanel (types ⇄ code, model/harness toggle)"
```

---

### Task 6: `WorldLens.tsx` + wiring + verification

**Files:**
- Create: `components/sector/WorldLens.tsx`
- Modify: `components/sector/LensProvider.tsx` (add `"world"` to `ViewMode`)
- Modify: `components/sector/ViewModeSwitch.tsx` (add the World tab)
- Modify: `components/sector/SectorWorkspace.tsx` (render `WorldLens`)

**Interfaces:**
- Consumes: `useLens` from `./LensProvider`; `worldNodes`, `worldHeadcount` from `lib/world.ts`; `parseQuery`, `chipFilter`, `type ChipType`, `type QueryResult` from `lib/world-query.ts`; `WorldGlobe`, `CausalSearch`, `WorldCodePanel`.
- Produces: `<WorldLens />` (the full lens). Adds `ViewMode "world"`.

- [ ] **Step 1: Write `components/sector/WorldLens.tsx`**

Create `components/sector/WorldLens.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { worldHeadcount, worldNodes } from "@/lib/world";
import { chipFilter, parseQuery, type ChipType, type QueryResult } from "@/lib/world-query";

import { CausalSearch } from "./CausalSearch";
import { useLens } from "./LensProvider";
import { WorldCodePanel } from "./WorldCodePanel";
import { WorldGlobe } from "./WorldGlobe";

// The // WORLD lens: the fleet's production estate as a globe, the Causal Search
// Engine bridging it to a live code slice. View-local query/chip state; the
// shared selectedId is the cross-lens link.
export function WorldLens({ className }: { className?: string }) {
	const { state, select, focusZone } = useLens();
	const agents = state.agents;
	const nodes = useMemo(() => worldNodes(agents), [agents]);
	const headcount = useMemo(() => worldHeadcount(agents), [agents]);

	const [chip, setChip] = useState<ChipType>("all");
	const [result, setResult] = useState<QueryResult | null>(() =>
		state.selectedId ? parseQuery(`depends on ${agents.find((a) => a.id === state.selectedId)?.name ?? ""}`, agents) : null,
	);

	const typeFilter = result?.typeFilter ?? chipFilter(chip);
	const focusIds = useMemo(() => {
		const ids = new Set<string>(result?.focusAgentIds ?? []);
		if (typeFilter) for (const n of nodes) if (n.type === typeFilter && n.agentId) ids.add(n.agentId);
		return ids;
	}, [result, typeFilter, nodes]);

	const runQuery = (text: string) => {
		setChip("all");
		setResult(parseQuery(text, agents));
	};
	const pickChip = (c: ChipType) => {
		setChip(c);
		setResult(c === "all" ? null : { intent: "filter", title: `${c} nodes`, summary: "", focusAgentIds: [], typeFilter: chipFilter(c) });
	};
	const pickAnchor = (agentId: string) => {
		select(agentId);
		const a = agents.find((x) => x.id === agentId);
		if (a) {
			focusZone(a.zone);
			setResult(parseQuery(`depends on ${a.name}`, agents));
		}
	};

	return (
		<div className={cn("flex h-full min-h-0", className)}>
			<div className="relative min-w-0 flex-1">
				<WorldGlobe nodes={nodes} focusIds={focusIds} selectedId={state.selectedId} onPick={pickAnchor} />
				<CausalSearch chip={chip} onChip={pickChip} onQuery={runQuery} />
				{result?.summary ? (
					<div className="pointer-events-none absolute left-4 top-4 max-w-[280px] border border-[var(--ret-border)] bg-[var(--ret-bg)]/70 px-3 py-2 font-mono text-[11px] text-[var(--ret-text-dim)] backdrop-blur-sm">
						{result.summary}
					</div>
				) : null}
			</div>
			<WorldCodePanel agents={agents} result={result} headcount={headcount} />
		</div>
	);
}
```

- [ ] **Step 2: Add the `"world"` ViewMode**

In `components/sector/LensProvider.tsx`, change the `ViewMode` union to append `"world"`:

```ts
export type ViewMode = "canvas" | "list" | "scatter" | "promote" | "incidents" | "queue" | "fleet" | "blast" | "world";
```

- [ ] **Step 3: Add the World tab**

In `components/sector/ViewModeSwitch.tsx`, add `Globe` to the lucide import and a `world` entry to the `VIEWS` array:

```ts
import { AlertTriangle, Globe, Inbox, LayoutGrid, Rocket, ScatterChart, Share2, Table2, Telescope } from "lucide-react";
```

```ts
	{ id: "blast", label: "Map", Icon: Share2 },
	{ id: "world", label: "World", Icon: Globe },
];
```

- [ ] **Step 4: Render the lens**

In `components/sector/SectorWorkspace.tsx`, add the import (alongside the other lens imports):

```tsx
import { WorldLens } from "./WorldLens";
```

and the render line (immediately after the `blast` line):

```tsx
						{view === "blast" ? <BlastLens /> : null}
						{view === "world" ? <WorldLens /> : null}
```

- [ ] **Step 5: Typecheck, test, build**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: typecheck clean; all test suites green (now including `test/world.test.ts`); build succeeds.

- [ ] **Step 6: Browser verification (Playwright)**

Start the dev server (`pnpm dev`, serves `http://127.0.0.1:3220`), then drive it with Playwright:

1. Navigate to `/dashboard`; click the **World** tab.
2. Assert a `<canvas aria-label="Production world model globe">` is present and the right panel shows "Modeled production estate" with a comma-grouped headcount and the node-type list.
3. Type `what depends on Atlas?` into the Causal search input + press Enter. Assert the right panel header reads `Atlas → downstream`, the code block contains `const world = {` and `control-plane-api`, and a `burnRate: 4.2` line renders in the critical color.
4. Click the **Harness** toggle; assert the code block now contains `function legalActions`.
5. Click the **Service** chip; assert it gets the active (accent) styling.
6. Take a screenshot to confirm the globe renders with labeled anchors. Remove any screenshot artifacts afterward.

Expected: all assertions pass; console shows no errors except the benign favicon 404.

- [ ] **Step 7: Commit**

```bash
git add components/sector/WorldLens.tsx components/sector/LensProvider.tsx components/sector/ViewModeSwitch.tsx components/sector/SectorWorkspace.tsx
git commit -m "feat: // WORLD lens — globe + Causal Search Engine + code slice, wired as 8th tab"
```

- [ ] **Step 8: Update the README**

Add the World lens to `README.md`: bump "Seven lenses" → "Eight lenses", add a bullet under the hero-surfaces intro, add the `"world"` row to the architecture diagram, add `lib/world.ts`/`world-query.ts`/`world-code.ts` + the four components to the directory map, and add `test/world.test.ts` to the test list. Commit:

```bash
git add README.md
git commit -m "docs: README — add the // WORLD lens"
```

---

## Self-Review

**1. Spec coverage:**
- §2 decisions (hybrid/balanced/globe/right-rail/CWM+harness/real-parser) → Tasks 1–6. ✓
- §4 data model (`WorldNodeType`, `WORLD_TAXONOMY`, `worldNodes`, anchors, sample, headcount) → Task 1. ✓
- §5 rendering (canvas-2D, rAF rotation, reduced-motion, anchors+billboard labels, selected accent ring, color=health) → Task 4. ✓
- §6 Causal Search Engine (chips + parser intents + fallback) → Task 2 (parser) + Task 5 (`CausalSearch`). ✓
- §7 code panel (`toWorldModel`/`toHarness`, NODE TYPES ⇄ code, MODEL/HARNESS toggle, monochrome-except-health) → Task 3 + Task 5 (`WorldCodePanel`). ✓
- §8 store wiring + files (ViewMode, tab, workspace render, view-local state, selectedId link, no second timer) → Task 6. ✓
- §11 testing (unit + typecheck/build + Playwright) → Tasks 1–3 (unit) + Task 6 (build + Playwright). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step contains complete code. ✓

**3. Type consistency:** `WorldNode`/`WorldNodeType`/`TaxonomyRow` defined in Task 1 and consumed unchanged in Tasks 2/4/5. `QueryResult`/`ChipType`/`CHIP_TYPES`/`chipFilter`/`parseQuery` defined in Task 2 and used unchanged in Tasks 3/5/6. `toWorldModel`/`toHarness` (Task 3) consumed in Task 5. `WorldGlobe` props `{nodes, focusIds, selectedId, onPick}` (Task 4) match the call site in Task 6. `WorldCodePanel` props `{agents, result, headcount}` (Task 5) match Task 6. `CausalSearch` props `{chip, onChip, onQuery}` (Task 5) match Task 6. ✓

No issues found.
