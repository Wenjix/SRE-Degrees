// Blast radius & authority — "if this agent makes one bad call, what breaks?"
//
// Composes the four things that decide blast: dependsOn (who is downstream),
// tools (what authority it holds), autonomyTier (what oversight contains it),
// and provingEnv (whether it acts on real traffic). Pure + node --test, same
// discipline as lib/promotion.ts and lib/fleet.ts.

import type { AutonomyTier, SreAgent, Tier } from "./sre-data";

// tools that change the world (vs route/observe/page) — what makes blast real.
const MUTATING_TOOL = new Set(["scale", "heal", "lock"]);

// criticality tier per zone (0 = revenue-critical) — the credibility classification.
// Mirrors zones[].tier in sre-data; kept inline so this module stays type-only
// (runtime-import-free) and unit-testable under node --test.
const ZONE_TIER: Record<Tier, number> = { core: 0, edge: 1, data: 1, batch: 2 };

// What stops a bad call, per oversight tier. Mirrors TIER_MEANING in promotion.ts.
const CONTAINMENT: Record<AutonomyTier, string> = {
	harnessed: "Human approves every action",
	supervised: "Auto routine · human approves risky actions",
	guarded: "Full auto behind guardrails + auto-rollback",
	autonomous: "Human on-the-loop · auto-rollback + kill-switch",
};

export type Blast = {
	originId: string;
	affectedIds: string[]; // transitive dependents, excluding the origin
	agentCount: number; // affected agents (excl. origin)
	services: string[]; // owned services in the blast (incl. origin's)
	zones: Tier[]; // zones touched (incl. origin's)
	inProduction: number; // nodes (incl. origin) acting on real traffic
	customerImpact: boolean; // blast reaches a Tier-0 zone or production
	depth: number; // longest cascade hop count
	containment: string; // what stops a bad call (from the origin's tier)
	authority: string[]; // the origin's mutating-tool labels
};

// reverse-dependency adjacency: dependents.get(id) = ids that depend on id.
function dependentsOf(list: SreAgent[]) {
	const m = new Map<string, string[]>();
	for (const a of list) for (const d of a.dependsOn) m.set(d, [...(m.get(d) ?? []), a.id]);
	return m;
}

export function blastRadius(list: SreAgent[], originId: string): Blast | null {
	const byId = new Map(list.map((a) => [a.id, a]));
	const origin = byId.get(originId);
	if (!origin) return null;
	const dependents = dependentsOf(list);

	// BFS downstream (who fails when origin fails), tracking depth.
	const affected = new Set<string>();
	let depth = 0;
	let frontier = [originId];
	while (frontier.length) {
		const next: string[] = [];
		for (const id of frontier)
			for (const dep of dependents.get(id) ?? [])
				if (dep !== originId && !affected.has(dep)) {
					affected.add(dep);
					next.push(dep);
				}
		if (next.length) depth += 1;
		frontier = next;
	}

	const nodes = [origin, ...[...affected].map((id) => byId.get(id)!).filter(Boolean)];
	return {
		originId,
		affectedIds: [...affected],
		agentCount: affected.size,
		services: [...new Set(nodes.map((a) => a.service.name))],
		zones: [...new Set(nodes.map((a) => a.zone))],
		inProduction: nodes.filter((a) => a.provingEnv === "production").length,
		customerImpact: nodes.some((a) => ZONE_TIER[a.zone] === 0 || a.provingEnv === "production"),
		depth,
		containment: CONTAINMENT[origin.autonomyTier],
		authority: origin.tools.filter((t) => MUTATING_TOOL.has(t.id)).map((t) => t.label),
	};
}

export type BlastRank = { id: string; name: string; agentCount: number; customerImpact: boolean; tier: SreAgent["autonomyTier"] };

// Fleet view: agents ranked by how far a bad call propagates. Ties broken by
// customer impact, then name, so the order is stable.
export function topBlastRadii(list: SreAgent[], limit = 6): BlastRank[] {
	return list
		.map((a) => {
			const b = blastRadius(list, a.id);
			return { id: a.id, name: a.name, agentCount: b?.agentCount ?? 0, customerImpact: b?.customerImpact ?? false, tier: a.autonomyTier };
		})
		.filter((r) => r.agentCount > 0)
		.sort((a, b) => b.agentCount - a.agentCount || Number(b.customerImpact) - Number(a.customerImpact) || a.name.localeCompare(b.name))
		.slice(0, limit);
}
