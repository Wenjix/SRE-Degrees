import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blastRadius, topBlastRadii } from "../lib/blast.ts";
import { agents } from "../lib/sre-data.ts";
import type { SreAgent } from "../lib/sre-data.ts";

const idOf = (name: string) => agents.find((a) => a.name === name)!.id;

// Minimal synthetic agent for the graph-shape tests.
function mk(id: string, dependsOn: string[], over: Partial<SreAgent> = {}): SreAgent {
	return {
		id, name: id.toUpperCase(), zone: "core", status: "healthy", autonomyTier: "supervised",
		provingEnv: "shadow", dependsOn, tools: [],
		service: { name: `${id}-svc`, sloTarget: 99.9, burnRate: 0.5, errorBudgetPct: 90 },
		...over,
	} as unknown as SreAgent;
}

describe("blast radius (reverse-dependency BFS)", () => {
	it("walks transitive dependents and counts hops as depth", () => {
		// c -> b -> a  (c depends on b, b depends on a)
		const list = [mk("a", []), mk("b", ["a"]), mk("c", ["b"])];
		const b = blastRadius(list, "a")!;
		assert.equal(b.agentCount, 2);
		assert.deepEqual(new Set(b.affectedIds), new Set(["b", "c"]));
		assert.equal(b.depth, 2);
		// a leaf blasts nothing
		assert.equal(blastRadius(list, "c")!.agentCount, 0);
	});

	it("returns null for an unknown agent", () => {
		assert.equal(blastRadius(agents, "nope"), null);
	});

	it("derives containment from the origin's oversight tier", () => {
		const list = [mk("a", [], { autonomyTier: "autonomous" }), mk("b", ["a"])];
		assert.match(blastRadius(list, "a")!.containment, /kill-switch/);
	});

	it("flags customer impact when the blast reaches a Tier-0 (core) zone", () => {
		const list = [mk("edge1", [], { zone: "edge" }), mk("core1", ["edge1"], { zone: "core" })];
		assert.equal(blastRadius(list, "edge1")!.customerImpact, true);
	});

	it("collects only the origin's MUTATING authority", () => {
		const tools = [
			{ id: "observe", icon: "observe", label: "Observe", active: false },
			{ id: "scale", icon: "scale", label: "Scale", active: false },
		];
		const list = [mk("a", [], { tools: tools as never }), mk("b", ["a"])];
		assert.deepEqual(blastRadius(list, "a")!.authority, ["Scale"]);
	});
});

describe("blast radius over the seeded fleet", () => {
	it("Iris has the widest blast despite sitting at supervised/shadow", () => {
		const b = blastRadius(agents, idOf("Iris"))!;
		assert.equal(b.agentCount, 6);
		assert.equal(b.depth, 2);
		assert.equal(b.customerImpact, true);
		assert.ok(b.affectedIds.includes(idOf("Atlas")), "the critical core is downstream of Iris");
	});

	it("Hermes runs autonomous in production, upstream of the core", () => {
		const b = blastRadius(agents, idOf("Hermes"))!;
		assert.equal(b.agentCount, 4);
		assert.match(b.containment, /kill-switch/);
		assert.deepEqual(b.authority, []); // no mutating tools — its leverage is positional
	});

	it("ranks the fleet by blast radius, widest first", () => {
		const top = topBlastRadii(agents);
		assert.deepEqual(
			top.slice(0, 3).map((r) => r.name),
			["Iris", "Hermes", "Atlas"],
		);
		assert.equal(top[0].agentCount, 6);
	});
});
