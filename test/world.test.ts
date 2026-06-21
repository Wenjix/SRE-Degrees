import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agents } from "../lib/sre-data.ts";
import { WORLD_TAXONOMY, taxonomyRows, worldHeadcount, worldNodes } from "../lib/world.ts";
import { CHIP_TYPES, chipFilter, parseQuery } from "../lib/world-query.ts";
import { toHarness, toWorldModel } from "../lib/world-code.ts";

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
		const atlasAgent = agents.find((a) => a.name === "Atlas");
		assert.ok(atlasAgent, "Atlas agent should exist");
		const atlas = nodes.find((n) => n.id === `agent:${atlasAgent.id}`);
		assert.ok(atlas, "Atlas node should exist");
		assert.equal(atlas.status, "critical");
		const cpa = nodes.find((n) => n.id === "svc:control-plane-api");
		assert.ok(cpa, "control-plane-api service should exist");
		assert.equal(cpa.status, "critical"); // burnRate 4.2 > 3
	});
});

const id = (name: string) => agents.find((a) => a.name === name)!.id;

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

	it("the bare word 'autonomy' reaches the autonomy intent", () => {
		const r = parseQuery("autonomy", agents);
		assert.equal(r.intent, "autonomy");
		assert.ok(r.focusAgentIds.includes(id("Hermes")));
	});
});

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

	it("flips the review invariant to ✗ for an autonomous-but-unreviewed slice", () => {
		const auton = parseQuery("autonomy", agents); // focuses Hermes (autonomous, sampling < 0.05)
		const code = toWorldModel(auton, agents);
		assert.match(code, /reviewed\(w\) \|\| !autonomous\(w\)\)\s+\/\/ ✗/);
	});

	it("HARNESS omits the block guard for a non-burning slice", () => {
		const auton = parseQuery("autonomy", agents); // Hermes owns event-bus (burn ≤ 1)
		const code = toHarness(auton, agents);
		assert.match(code, /no burning owned service/);
		assert.doesNotMatch(code, /return block\(a\)/);
	});
});
