import type { Incident, PendingAction, SreAgent } from "./sre-data";

export type PolicyDecision = "allow" | "needs-human" | "blocked" | "escalate-owner";
export type StageStatus = "done" | "active" | "pending";

export type ActionPolicyTrace = {
	policyVersion: string;
	proposedAction: string;
	legalCheck: string;
	decision: PolicyDecision;
	blockedReason: string | null;
	ownerRoute: string | null;
	finalState: string;
	learningSignal: string;
	mttrSavedMin: number;
};

const POLICY_VERSION = "policy/sre-harness@0.3.1";
const RBAC_EXHIBIT_ID = "ACT-96";

export function policyTraceForAction(action: PendingAction, agents: SreAgent[]): ActionPolicyTrace {
	const agent = agents.find((a) => a.id === action.agentId);
	const prod = /prod/i.test(action.blastScope);
	const highBlast = action.risk === "mutate" && (action.blastInstances > 8 || prod);

	if (action.id === RBAC_EXHIBIT_ID) {
		return {
			policyVersion: POLICY_VERSION,
			proposedAction: `propose_action(${JSON.stringify(action.action)})`,
			legalCheck: "is_legal(action, ownership_graph, rbac)",
			decision: "escalate-owner",
			blockedReason: "RBAC denies restart outside Sylvie's service boundary",
			ownerRoute: "Ash · owner of auth-cache",
			finalState: "blocked locally; owner escalation prepared",
			learningSignal: "blocked-action trace -> permission policy candidate",
			mttrSavedMin: 18,
		};
	}

	if (highBlast) {
		return {
			policyVersion: POLICY_VERSION,
			proposedAction: `propose_action(${JSON.stringify(action.action)})`,
			legalCheck: "is_legal(action, blast_radius, review_floor)",
			decision: "needs-human",
			blockedReason: `mutating ${action.blastInstances} instances in ${action.blastScope}`,
			ownerRoute: agent ? `${agent.name} operator approval` : null,
			finalState: "queued for human approval before commit",
			learningSignal: "human decision labels the guardrail",
			mttrSavedMin: action.confidence >= 0.9 ? 11 : 7,
		};
	}

	return {
		policyVersion: POLICY_VERSION,
		proposedAction: `propose_action(${JSON.stringify(action.action)})`,
		legalCheck: "is_legal(action, reversible_change, blast_radius)",
		decision: "allow",
		blockedReason: null,
		ownerRoute: agent ? `${agent.name} within delegated scope` : null,
		finalState: "legal low-blast action",
		learningSignal: "successful trace updates proposer preference",
		mttrSavedMin: 4,
	};
}

export function incidentRunStages(incident: Incident): { id: "diagnose" | "fix" | "verify"; label: string; status: StageStatus; detail: string }[] {
	return [
		{
			id: "diagnose",
			label: "diagnose",
			status: incident.acknowledged || incident.commander ? "done" : "active",
			detail: incident.trigger,
		},
		{
			id: "fix",
			label: "fix",
			status: incident.resolved ? "done" : incident.acknowledged || incident.commander ? "active" : "pending",
			detail: incident.lastAction,
		},
		{
			id: "verify",
			label: "verify",
			status: incident.resolved ? "done" : incident.trend === "recovering" ? "active" : "pending",
			detail: incident.resolved ? `${incident.service} within budget` : "burn trend + guardrail check",
		},
	];
}

export function policyRemediationSummary(actions: PendingAction[], agents: SreAgent[]) {
	const traces = actions.map((a) => policyTraceForAction(a, agents));
	const blocked = traces.filter((t) => t.decision === "blocked" || t.decision === "escalate-owner").length;
	const needsHuman = traces.filter((t) => t.decision === "needs-human").length;
	const mttrSavedMin = traces.reduce((sum, t) => sum + t.mttrSavedMin, 0);
	return { blocked, needsHuman, mttrSavedMin, policyVersion: POLICY_VERSION };
}
