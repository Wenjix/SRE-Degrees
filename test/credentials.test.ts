import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	capstoneFor,
	credentialFor,
	credentialShortFor,
	disciplineFor,
	honorsFor,
	incidentCredits,
	numeralFor,
	TIER_CREDENTIAL,
} from "../lib/credentials.ts";
import { agents, incidentsSeed } from "../lib/sre-data.ts";

describe("SRE Degrees — credentials", () => {
	it("maps each tier to a distinct academic credential, short form, and numeral", () => {
		assert.equal(credentialFor("harnessed"), "Associate of SRE");
		assert.equal(credentialFor("guarded"), "Master of SRE");
		assert.equal(credentialFor("autonomous"), "Doctor of SRE");
		assert.equal(credentialShortFor("autonomous"), "D.SRE");
		assert.equal(numeralFor("harnessed"), "I");
		assert.equal(numeralFor("autonomous"), "IV");
		assert.equal(new Set(Object.values(TIER_CREDENTIAL)).size, 4); // all distinct
	});
});

describe("SRE Degrees — discipline + capstone", () => {
	it("derives a DISTINCT discipline and capstone per service domain", () => {
		const ledger = disciplineFor("payments-ledger");
		const edge = disciplineFor("cdn-cache");
		const bus = disciplineFor("event-bus");
		const control = disciplineFor("control-plane-api");
		assert.equal(ledger.discipline, "Transactional Data");
		assert.equal(edge.discipline, "Edge Delivery");
		assert.equal(bus.discipline, "Event Streaming");
		assert.equal(control.discipline, "Control Plane");
		// distinct scenario sentences, not a shared template
		assert.equal(new Set([ledger, edge, bus, control].map((d) => d.capstone)).size, 4);
		assert.match(edge.capstone, /rollback/);
		assert.match(bus.capstone, /backpressure|dropped events/);
	});

	it("falls back to Site Reliability for an unknown service", () => {
		assert.equal(disciplineFor("some-weird-svc").discipline, "Site Reliability");
	});

	it("capstoneFor reads the agent's owned service", () => {
		const zeus = agents.find((a) => a.name === "Zeus")!;
		assert.deepEqual(capstoneFor(zeus), disciplineFor(zeus.service.name));
	});
});

describe("SRE Degrees — honors + transcript", () => {
	it("honors escalate with live-fire credit and decision quality", () => {
		const hi = { evalPassRate: 0.998 };
		const lo = { evalPassRate: 0.99 };
		assert.equal(honorsFor(hi, true), "summa cum laude");
		assert.equal(honorsFor(hi, false), "cum laude");
		assert.equal(honorsFor(lo, true), "magna cum laude");
		assert.equal(honorsFor(lo, false), "");
	});

	it("transcript: an active implicated incident is probation, a resolved one is a credit", () => {
		const atlas = agents.find((a) => a.name === "Atlas")!; // INC-204 in the seed (unresolved)
		const probation = incidentCredits(atlas.id, incidentsSeed);
		assert.ok(probation.length >= 1);
		assert.equal(probation[0].status, "probation");
		const recovered = incidentsSeed.map((i) => ({ ...i, resolved: true }));
		assert.equal(incidentCredits(atlas.id, recovered)[0].status, "credit");
	});

	it("an agent with no incidents has an empty transcript", () => {
		assert.equal(incidentCredits("sre-does-not-exist", incidentsSeed).length, 0);
	});
});
