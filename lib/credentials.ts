// "SRE Degrees" — the autonomy ladder presented as conferred academic
// credentials. A promotion is a degree conferral; the criteria are a curriculum;
// surviving incidents earns live-fire credit. Pure + framework-free (type-only
// imports) so it runs under `node --test` type-stripping, mirroring promotion.ts.

import type { AutonomyTier, Incident, Severity, SreAgent } from "./sre-data";

// The degree ladder. harnessed → supervised → guarded → autonomous reads as
// Associate → Bachelor → Master → Doctor: each step is more autonomy, less
// oversight, exactly like a scholar earning the right to practice unsupervised.
export const TIER_CREDENTIAL: Record<AutonomyTier, string> = {
	harnessed: "Associate of SRE",
	supervised: "Bachelor of SRE",
	guarded: "Master of SRE",
	autonomous: "Doctor of SRE",
};

export const TIER_CREDENTIAL_SHORT: Record<AutonomyTier, string> = {
	harnessed: "A.SRE",
	supervised: "B.SRE",
	guarded: "M.SRE",
	autonomous: "D.SRE",
};

// Degree level as a Roman numeral for the conferral seal (Associate I … Doctor IV).
export const TIER_NUMERAL: Record<AutonomyTier, string> = {
	harnessed: "I",
	supervised: "II",
	guarded: "III",
	autonomous: "IV",
};

export function credentialFor(tier: AutonomyTier): string {
	return TIER_CREDENTIAL[tier];
}
export function credentialShortFor(tier: AutonomyTier): string {
	return TIER_CREDENTIAL_SHORT[tier];
}
export function numeralFor(tier: AutonomyTier): string {
	return TIER_NUMERAL[tier];
}

// A discipline + a distinct, scenario-specific capstone, derived from the service
// the agent protects — its specialization (mirrors real SRE tracks and the
// reference promotion-criteria cards). Keyword-ordered; first match wins.
export type Discipline = { discipline: string; capstone: string };

const DISCIPLINES: { test: RegExp; discipline: string; capstone: string }[] = [
	{ test: /control-plane|orchestr|scheduler/, discipline: "Control Plane", capstone: "leader failover with 0 split-brain across 5 partition drills" },
	{ test: /ledger|payment|txn|billing/, discipline: "Transactional Data", capstone: "0 data-divergence across 5 partition drills" },
	{ test: /consensus|store|quorum|state/, discipline: "Distributed State", capstone: "quorum recovery with 0 stale reads across 5 partitions" },
	{ test: /event|bus|stream|queue|kafka/, discipline: "Event Streaming", capstone: "0 dropped events under sustained backpressure (5 surges)" },
	{ test: /dns|resolver|route53/, discipline: "DNS & Routing", capstone: "0 dropped queries across 5 regions in a propagation race" },
	{ test: /edge|cdn|router|pop-fleet|waf|cache/, discipline: "Edge Delivery", capstone: "isolate + rollback <500ms across 10 deploy failure modes" },
	{ test: /ingest|pipeline|feed|sync/, discipline: "Data Pipelines", capstone: "0 data loss across 5 backfill / replay drills" },
	{ test: /nightly|job|gc|sweep|token|expiry|batch/, discipline: "Batch & Lifecycle", capstone: "0 orphaned resources across 5 sweep cycles" },
];

export function disciplineFor(serviceName: string): Discipline {
	const s = serviceName.toLowerCase();
	for (const d of DISCIPLINES) if (d.test.test(s)) return { discipline: d.discipline, capstone: d.capstone };
	return { discipline: "Site Reliability", capstone: "0 SLO breaches across 5 chaos drills" };
}

export function capstoneFor(agent: SreAgent): Discipline {
	return disciplineFor(agent.service.name);
}

// Latin honors for the conferral — earned, tied to live-fire incident learning
// and decision quality. "" = a pass without honors.
export function honorsFor(agent: Pick<SreAgent, "evalPassRate">, liveFireCredit: boolean): string {
	const topEval = agent.evalPassRate >= 0.997;
	if (liveFireCredit && topEval) return "summa cum laude";
	if (liveFireCredit) return "magna cum laude";
	if (topEval) return "cum laude";
	return "";
}

// The incident transcript: what the agent learned from past incidents. A
// recovered (resolved + implicated) incident is a live-fire CREDIT; an active
// one is probation — trust withheld until the fire is out.
export type IncidentCredit = { id: string; service: string; severity: Severity; status: "credit" | "probation" };

export function incidentCredits(agentId: string, incidents: Incident[]): IncidentCredit[] {
	return incidents
		.filter((i) => i.agentIds.includes(agentId))
		.map((i) => ({
			id: i.id,
			service: i.service,
			severity: i.severity,
			status: i.resolved ? ("credit" as const) : ("probation" as const),
		}));
}
