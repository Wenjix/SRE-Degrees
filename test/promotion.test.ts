import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	blockingReason,
	computeReadiness,
	eligible,
	GATES,
	gateProgress,
	nextTier,
	prevTier,
	TIER_RANK,
} from "../lib/promotion.ts";
import type { SreAgent } from "../lib/sre-data.ts";

const HOUR = 3_600_000;

// Minimal fixture — only the fields the promotion engine reads.
function agent(over: Partial<SreAgent> = {}): SreAgent {
	return {
		status: "healthy",
		autonomyTier: "supervised",
		provingEnv: "canary",
		verifiedRuns: 300,
		successRate: 0.9995,
		overrideRate: 0.005,
		incidents: 0,
		soakMs: 7 * HOUR,
		slo: { burnRate: 0.5, target: 99.9 },
		...over,
	} as unknown as SreAgent;
}

describe("promotion ladder", () => {
	it("orders tiers and steps next/prev", () => {
		assert.equal(TIER_RANK.harnessed, 0);
		assert.equal(TIER_RANK.autonomous, 3);
		assert.equal(nextTier("harnessed"), "supervised");
		assert.equal(nextTier("autonomous"), null);
		assert.equal(prevTier("harnessed"), null);
		assert.equal(prevTier("guarded"), "supervised");
	});

	it("exposes ramping gate targets", () => {
		assert.equal(GATES.harnessed.verifiedRuns, 50);
		assert.equal(GATES.supervised.verifiedRuns, 250);
		assert.equal(GATES.guarded.verifiedRuns, 1000);
		assert.ok(GATES.guarded.slo > GATES.supervised.slo);
	});
});

describe("readiness + eligibility", () => {
	it("a fully-proven candidate is eligible at readiness 100", () => {
		const a = agent();
		assert.equal(eligible(a), true);
		assert.equal(computeReadiness(a), 100);
		assert.equal(blockingReason(a), null);
	});

	it("a critical agent loses trust (hard-capped) and cannot promote", () => {
		const a = agent({ status: "critical", incidents: 1 });
		assert.equal(eligible(a), false);
		assert.ok(computeReadiness(a) <= 60, "critical hard-caps readiness near 60");
	});

	it("cannot promote past an unreached proving ground", () => {
		const a = agent({ provingEnv: "shadow" }); // needs canary for guarded
		assert.equal(eligible(a), false);
		assert.match(blockingReason(a) ?? "", /canary/);
		const env = gateProgress(a).find((c) => c.id === "env");
		assert.equal(env?.pass, false);
	});

	it("treats override rate as inverted (lower is better)", () => {
		const ok = gateProgress(agent({ overrideRate: 0 })).find((c) => c.id === "override");
		const bad = gateProgress(agent({ overrideRate: 0.5 })).find((c) => c.id === "override");
		assert.equal(ok?.inverted, true);
		assert.equal(ok?.pass, true);
		assert.equal(bad?.pass, false);
		assert.ok((ok?.fraction ?? 0) > (bad?.fraction ?? 1));
	});

	it("autonomous agents have no further gate", () => {
		const a = agent({ autonomyTier: "autonomous" });
		assert.equal(eligible(a), false);
		assert.equal(computeReadiness(a), 100);
		assert.equal(gateProgress(a).length, 0);
	});

	it("requires the soak timer before promotion", () => {
		const a = agent({ soakMs: 1 * HOUR }); // guarded gate needs 6h
		assert.equal(eligible(a), false);
		const soak = gateProgress(a).find((c) => c.id === "soak");
		assert.equal(soak?.pass, false);
	});
});
