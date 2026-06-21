import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	budgetPortfolio,
	correlatedAuthority,
	fleetEconomics,
	fleetGovernance,
	ownershipRollup,
} from "../lib/fleet.ts";
import { agents } from "../lib/sre-data.ts";
import type { SreAgent } from "../lib/sre-data.ts";

// Synthetic agent — only the fields the fleet derivations read.
function mk(over: Partial<SreAgent> = {}): SreAgent {
	return {
		id: "x", name: "X", org: "core-tier", zone: "core", status: "healthy",
		autonomyTier: "supervised", provingEnv: "shadow", overrideRate: 0.01, cooldown: 0,
		tokensPerMin: 1000,
		cost: { current: 7, unit: "$/hr", series: [] },
		actions: { current: 40, unit: "/min", series: [] },
		service: { name: "svc", sloTarget: 99.9, burnRate: 0.5, errorBudgetPct: 90 },
		tools: [],
		dependsOn: [],
		...over,
	} as unknown as SreAgent;
}

describe("fleet economics", () => {
	it("rolls up spend over the seeded fleet and flags runaways", () => {
		const e = fleetEconomics(agents);
		assert.equal(e.costHr, 147); // 147.2 -> 147
		assert.ok(e.costDeltaPct > 0, "spend is up week-over-week");
		assert.equal(e.topSpenders[0].name, "Vela"); // the runaway query-cache
		assert.equal(e.byTeam[0].team, "data-tier"); // carries the cost
		assert.deepEqual(
			e.runaway.map((r) => r.name),
			["Vela", "Atlas"],
		);
	});

	it("computes spend efficiency per 1k actions", () => {
		const e = fleetEconomics([mk({ cost: { current: 60, unit: "$/hr", series: [] }, actions: { current: 1000, unit: "/min", series: [] } })]);
		// 1000/min = 60,000/hr = 60k actions -> $60 / 60k = $1.00 per 1k
		assert.equal(e.costPerKActions, 1);
	});
});

describe("fleet governance", () => {
	it("distributes the seeded fleet across the oversight ladder", () => {
		const g = fleetGovernance(agents);
		assert.deepEqual(g.byTier, { harnessed: 4, supervised: 7, guarded: 2, autonomous: 1 });
		assert.deepEqual(g.autonomousInProd, ["Hermes"]); // the only no-human-in-loop agent on real traffic
		assert.equal(g.highAutonomyInProd, 2); // Hera + Hermes
		assert.equal(g.netLadderSteps, 1); // one net step up vs prior week
	});

	it("action-weights the fleet override rate", () => {
		const g = fleetGovernance([
			mk({ overrideRate: 0, actions: { current: 100, unit: "/min", series: [] } }),
			mk({ overrideRate: 0.2, actions: { current: 100, unit: "/min", series: [] } }),
		]);
		assert.equal(g.fleetOverrideRate, 0.1);
	});
});

describe("correlated authority (blast correlation)", () => {
	it("surfaces dependency hubs and autonomous-upstream risk in the seeded fleet", () => {
		const risks = correlatedAuthority(agents);
		const auto = risks.find((r) => r.kind === "autonomous-upstream");
		assert.ok(auto, "Hermes is autonomous and upstream of Atlas");
		assert.ok(auto?.agents.includes("Hermes"));
		const atlasHub = risks.find((r) => r.id === "hub-sre-7f2a");
		assert.ok(atlasHub, "Atlas is a dependency hub");
		assert.equal(atlasHub?.high, true, "a critical/burning hub is high-severity");
	});

	it("requires at least two dependents to call something a hub", () => {
		const list = [
			mk({ id: "hub", name: "Hub" }),
			mk({ id: "a", name: "A", dependsOn: ["hub"] }),
		];
		assert.equal(correlatedAuthority(list).filter((r) => r.kind === "hub").length, 0);
		list.push(mk({ id: "b", name: "B", dependsOn: ["hub"] }));
		assert.equal(correlatedAuthority(list).filter((r) => r.kind === "hub").length, 1);
	});

	it("flags clustered high-autonomy mutate power in a zone", () => {
		const scale = [{ id: "scale", icon: "scale", label: "Scale", active: false }];
		const list = [
			mk({ id: "1", name: "One", zone: "core", autonomyTier: "guarded", tools: scale as never }),
			mk({ id: "2", name: "Two", zone: "core", autonomyTier: "autonomous", tools: scale as never }),
			mk({ id: "3", name: "Three", zone: "edge", autonomyTier: "guarded", tools: scale as never }),
		];
		const shared = correlatedAuthority(list).filter((r) => r.kind === "shared-mutate");
		assert.equal(shared.length, 1); // only core has two mutators
		assert.equal(shared[0].agents.length, 2);
	});
});

describe("ownership + budget portfolio", () => {
	it("attributes risk to the owning team, riskiest first", () => {
		const rows = ownershipRollup(agents);
		assert.equal(rows[0].team, "core-tier"); // owns the only critical + most autonomy
		assert.equal(rows[0].criticals, 1);
		assert.equal(rows[0].lead, "rivera");
	});

	it("lists burning owned services worst-first", () => {
		const p = budgetPortfolio(agents);
		assert.equal(p.burning.length, 3);
		assert.equal(p.burning[0].service, "control-plane-api");
		assert.equal(p.burning[0].burnRate, 4.2);
		assert.equal(p.withinBudget, 11);
	});
});
