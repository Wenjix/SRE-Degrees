import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	LEADERBOARD,
	REWARD_FORMULA,
	SWEEP,
	SWEEP_INCIDENTS,
} from "../lib/cidg/leaderboard.ts";
import { REWARD_WEIGHTS } from "../lib/cidg/trajectory.ts";
import { FRONTIER_REX_SWEEP, REX_TASKSET, frontierRexSummary, rexLift } from "../lib/rex-evidence.ts";

// The Lab leaderboard is DERIVED from rex-evidence (the single source of truth).
// These assertions are the drift detector the module comment promises: if a future
// edit desyncs the leaderboard from FRONTIER_REX_SWEEP / REX_TASKSET, the suite fails
// here instead of silently rendering stale numbers.
describe("CIDG leaderboard derives from rex-evidence (single source of truth)", () => {
	it("has exactly one row per frontier sweep entry, in the same order", () => {
		assert.equal(LEADERBOARD.length, FRONTIER_REX_SWEEP.length);
		assert.deepEqual(
			LEADERBOARD.map((r) => r.model),
			FRONTIER_REX_SWEEP.map((e) => e.model),
		);
	});

	it("projects every row straight from the source — no parsing, no drift", () => {
		LEADERBOARD.forEach((row, i) => {
			const src = FRONTIER_REX_SWEEP[i];
			assert.equal(row.provider, src.providerName);
			assert.equal(row.route, src.inferenceRoute);
			assert.equal(row.anchor, src.routeNote);
			assert.equal(row.baseline, src.baselineScore);
			assert.equal(row.rex, src.rexScore);
			assert.equal(row.lift, rexLift(src));
			assert.equal(row.baselineCleanWins, src.baselineCleanWins);
			assert.equal(row.rexCleanWins, src.rexCleanWins);
		});
	});

	it("keeps provider and route within their unions for every row", () => {
		const providers = new Set(["Anthropic", "OpenAI", "Google", "DeepSeek"]);
		for (const row of LEADERBOARD) {
			assert.ok(providers.has(row.provider), `unknown provider: ${row.provider}`);
			assert.ok(row.route === "native" || row.route === "gateway", `bad route: ${row.route}`);
		}
	});

	it("derives SWEEP dimensions from REX_TASKSET + the frontier summary", () => {
		const s = frontierRexSummary();
		assert.equal(SWEEP.nIncidents, REX_TASKSET.tasksetSize);
		assert.equal(SWEEP.nSolvable, REX_TASKSET.solvableIncidents);
		assert.equal(SWEEP.nModels, s.modelCount);
		assert.equal(SWEEP.ceiling, s.ceilingScore);
		// derived identity string must still read exactly as the published ceiling.
		assert.equal(SWEEP.ceilingIdentity, "(4×1.0 + 0.30) / 5 = 0.86");
	});

	it("covers exactly the taskset in SWEEP_INCIDENTS", () => {
		assert.equal(SWEEP_INCIDENTS.length, REX_TASKSET.tasksetSize);
		assert.equal(SWEEP_INCIDENTS.filter((inc) => inc.solvable).length, REX_TASKSET.solvableIncidents);
		const singleton = SWEEP_INCIDENTS.find((inc) => !inc.solvable);
		assert.ok(singleton);
		assert.equal(singleton.rexCell, REX_TASKSET.singletonEscalationScore);
	});

	it("sources REWARD_FORMULA weights from the single REWARD_WEIGHTS definition", () => {
		const byKey = Object.fromEntries(REWARD_FORMULA.terms.map((t) => [t.key, t.weight]));
		assert.equal(byKey.diagnosis, REWARD_WEIGHTS.diagnosis);
		assert.equal(byKey.correct_fix, REWARD_WEIGHTS.correctFix);
		assert.equal(byKey.resolved, REWARD_WEIGHTS.resolved);
		assert.equal(byKey.trap, REWARD_WEIGHTS.trapPenalty);
		assert.equal(REWARD_FORMULA.expr, "score = 0.30·diagnosis + 0.25·correct_fix + 0.45·resolved − 0.60·trap");
	});
});
