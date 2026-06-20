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

// Minimal fixture — a fully-proven supervised candidate (next tier = guarded).
// Only the fields the promotion engine reads.
function agent(over: Partial<SreAgent> = {}): SreAgent {
	return {
		status: "healthy",
		autonomyTier: "supervised",
		provingEnv: "canary",
		verifiedRuns: 300,
		successRate: 0.9995,
		overrideRate: 0.005,
		reviewSamplingRate: 0.4,
		evalPassRate: 0.99,
		humanAgreementRate: 0.97,
		incidents: 0,
		soakMs: 7 * HOUR,
		slo: { burnRate: 0.5, target: 99.9 },
		service: { name: "checkout-api", sloTarget: 99.9, burnRate: 0.5, errorBudgetPct: 85 },
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

	it("exposes ramping gate targets incl. service + eval + sampling", () => {
		assert.equal(GATES.harnessed.verifiedRuns, 50);
		assert.equal(GATES.guarded.verifiedRuns, 1000);
		assert.ok(GATES.guarded.evalMin > GATES.supervised.evalMin);
		assert.ok(GATES.guarded.serviceBudgetMin >= GATES.supervised.serviceBudgetMin);
		assert.ok(GATES.guarded.samplingFloor < GATES.supervised.samplingFloor);
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

	it("a BURNING owned service blocks promotion even when the agent is healthy", () => {
		const a = agent({ status: "healthy", service: { name: "payments-ledger", sloTarget: 99.9, burnRate: 3.8, errorBudgetPct: 7 } });
		assert.equal(eligible(a), false);
		const svc = gateProgress(a).find((c) => c.id === "service");
		assert.equal(svc?.pass, false);
		assert.match(blockingReason(a) ?? "", /burning|payments-ledger/);
		assert.ok(computeReadiness(a) <= 55, "a burning owned service tanks readiness");
	});

	it("low review coverage blocks certifying a low correction rate (the unwatched-gate fix)", () => {
		const a = agent({ overrideRate: 0, reviewSamplingRate: 0.02 }); // perfect correction, but nothing watched
		assert.equal(eligible(a), false);
		const coverage = gateProgress(a).find((c) => c.id === "coverage");
		assert.equal(coverage?.pass, false);
		assert.match(blockingReason(a) ?? "", /reviewed/);
	});

	it("poor decision-quality (eval) blocks promotion", () => {
		const a = agent({ evalPassRate: 0.9 }); // below the guarded gate's 0.985
		assert.equal(eligible(a), false);
		const q = gateProgress(a).find((c) => c.id === "quality");
		assert.equal(q?.pass, false);
	});

	it("treats correction rate as inverted (lower is better)", () => {
		const ok = gateProgress(agent({ overrideRate: 0 })).find((c) => c.id === "correction");
		const bad = gateProgress(agent({ overrideRate: 0.5 })).find((c) => c.id === "correction");
		assert.equal(ok?.inverted, true);
		assert.equal(ok?.pass, true);
		assert.equal(bad?.pass, false);
		assert.ok((ok?.fraction ?? 0) > (bad?.fraction ?? 1));
	});

	it("cannot promote past an unreached proving ground", () => {
		const a = agent({ provingEnv: "shadow" }); // needs canary for guarded
		assert.equal(eligible(a), false);
		assert.match(blockingReason(a) ?? "", /canary/);
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
