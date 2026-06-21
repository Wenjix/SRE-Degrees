import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { incidentRunStages, policyRemediationSummary, policyTraceForAction } from "../lib/policy-trace.ts";
import { agents, incidentsSeed, pendingActionsSeed } from "../lib/sre-data.ts";

describe("policy trace", () => {
	it("routes the RBAC exhibit to the dependency owner and records a learning signal", () => {
		const act = pendingActionsSeed.find((a) => a.id === "ACT-96");
		assert.ok(act);
		const trace = policyTraceForAction(act, agents);
		assert.equal(trace.decision, "escalate-owner");
		assert.match(trace.blockedReason ?? "", /RBAC denies/);
		assert.equal(trace.ownerRoute, "Ash · owner of auth-cache");
		assert.match(trace.learningSignal, /permission policy candidate/);
	});

	it("requires human approval for mutating high-blast production actions", () => {
		const act = pendingActionsSeed.find((a) => a.id === "ACT-92");
		assert.ok(act);
		const trace = policyTraceForAction(act, agents);
		assert.equal(trace.decision, "needs-human");
		assert.match(trace.legalCheck, /blast_radius/);
		assert.match(trace.finalState, /queued/);
	});

	it("allows low-blast read-only actions inside delegated scope", () => {
		const act = pendingActionsSeed.find((a) => a.id === "ACT-94");
		assert.ok(act);
		const trace = policyTraceForAction(act, agents);
		assert.equal(trace.decision, "allow");
		assert.equal(trace.blockedReason, null);
	});

	it("derives diagnose/fix/verify incident stages from incident state", () => {
		const live = incidentRunStages(incidentsSeed[0]);
		assert.deepEqual(live.map((s) => s.status), ["active", "pending", "pending"]);
		const resolved = incidentRunStages({ ...incidentsSeed[0], acknowledged: true, resolved: true });
		assert.deepEqual(resolved.map((s) => s.status), ["done", "done", "done"]);
	});

	it("summarizes safe-action time and guarded/owner-routed actions", () => {
		const s = policyRemediationSummary(pendingActionsSeed, agents);
		assert.ok(s.mttrSavedMin > 0);
		assert.equal(s.needsHuman, 3);
		assert.equal(s.blocked, 1);
		assert.match(s.policyVersion, /policy\/sre-harness/);
	});
});
