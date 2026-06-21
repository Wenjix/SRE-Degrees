import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	FRONTIER_REX_SWEEP,
	QWEN_REX_TARGET,
	frontierRexSummary,
	formatScore,
	rexAtCeiling,
	rexCeiling,
	rexEvidenceForAgent,
	rexLift,
	rexPromotionSignal,
} from "../lib/rex-evidence.ts";

describe("REx evidence math", () => {
	it("computes the ceiling as four solved incidents plus singleton escalation", () => {
		assert.equal(
			rexCeiling({
				solvableIncidents: 4,
				unsolvableIncidents: 1,
				singletonEscalationScore: 0.3,
			}),
			0.86,
		);
		assert.equal(formatScore(0.86), "0.860");
	});

	it("computes per-model lift and recognizes the ceiling-aware score", () => {
		const haiku = FRONTIER_REX_SWEEP.find((r) => r.model === "claude-haiku-4-5");
		assert.ok(haiku);
		assert.equal(rexLift(haiku), 0.23);
		assert.equal(rexAtCeiling(haiku), true);
	});

	it("summarizes spread compression and clean-win lift across the frontier sweep", () => {
		const s = frontierRexSummary();
		assert.equal(s.modelCount, 5);
		assert.equal(s.baselineMin, 0.63);
		assert.equal(s.baselineMax, 0.81);
		assert.equal(s.baselineSpread, 0.18);
		assert.equal(s.rexSpread, 0);
		assert.equal(s.cleanWinsBaseline, 13);
		assert.equal(s.cleanWinsRex, 20);
		assert.equal(s.cleanWinSlots, 25);
		assert.equal(s.allAtCeiling, true);
	});

	it("does not treat a high REx score as promotion proof without task coverage", () => {
		const row = FRONTIER_REX_SWEEP[0];
		assert.deepEqual(rexPromotionSignal(row, 0.2), {
			pass: false,
			reason: "task coverage too thin",
		});
		assert.deepEqual(rexPromotionSignal(row, 1), {
			pass: true,
			reason: "ceiling-aware REx proof",
		});
	});

	it("keeps Qwen3-30B-A3B as a pending training target, not a frontier claim", () => {
		assert.equal(QWEN_REX_TARGET.model, "Qwen3-30B-A3B");
		assert.equal(QWEN_REX_TARGET.status, "pending");
		assert.equal(FRONTIER_REX_SWEEP.some((r) => r.model === QWEN_REX_TARGET.model), false);
	});

	it("maps demo agents to stable REx evidence rows", () => {
		assert.equal(rexEvidenceForAgent("sre-3a07").model, "gpt-5.5");
		assert.equal(rexEvidenceForAgent("sre-4c2d").model, "claude-opus-4-8");
		assert.equal(rexEvidenceForAgent("unknown-agent").role, "frontier");
	});
});
