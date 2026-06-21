import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agents } from "../lib/sre-data.ts";
import { WORLD_TAXONOMY, taxonomyRows, worldHeadcount, worldNodes } from "../lib/world.ts";
import { CHIP_TYPES, chipFilter, parseQuery } from "../lib/world-query.ts";

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
});
