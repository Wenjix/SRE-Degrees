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
