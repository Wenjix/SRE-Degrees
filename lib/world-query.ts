// The Causal Search Engine: filter chips + a small honest intent grammar over
// the live store. No LLM, no backend — it genuinely parses and never fabricates
// (unrecognized → name/type fallback). Type-only imports; reverse-dependency
// BFS is mirrored inline (as lib/blast.ts does) to stay node-testable.

import type { SreAgent } from "./sre-data";
import type { WorldNodeType } from "./world";

export type QueryIntent = "depends" | "burning" | "cost" | "autonomy" | "filter" | "fallback";

export type QueryResult = {
	intent: QueryIntent;
	title: string;
	summary: string;
	focusAgentIds: string[];
	typeFilter: WorldNodeType | null;
};

export const CHIP_TYPES = ["all", "agent", "service", "pod", "host", "storage", "operation"] as const;
export type ChipType = (typeof CHIP_TYPES)[number];

function downstream(agents: SreAgent[], originId: string): string[] {
	const dep = new Map<string, string[]>();
	for (const a of agents) for (const d of a.dependsOn) dep.set(d, [...(dep.get(d) ?? []), a.id]);
	const out = new Set<string>();
	let frontier = [originId];
	while (frontier.length) {
		const next: string[] = [];
		for (const cur of frontier)
			for (const c of dep.get(cur) ?? [])
				if (c !== originId && !out.has(c)) {
					out.add(c);
					next.push(c);
				}
		frontier = next;
	}
	return [...out];
}

const norm = (s: string) => s.toLowerCase().trim();
function findAgent(agents: SreAgent[], n: string): SreAgent | null {
	return (
		agents.find((a) => n.includes(a.name.toLowerCase())) ??
		agents.find((a) => n.includes(a.service.name.toLowerCase())) ??
		null
	);
}

export function parseQuery(q: string, agents: SreAgent[]): QueryResult {
	const n = norm(q);
	if (!n) return { intent: "filter", title: "All entities", summary: "The full modeled estate.", focusAgentIds: [], typeFilter: null };

	if (/\b(depends?|blast|downstream|cascade)\b/.test(n)) {
		const a = findAgent(agents, n);
		if (a) {
			const ids = downstream(agents, a.id);
			return { intent: "depends", title: `${a.name} → downstream`, summary: `${ids.length} agents depend on ${a.name}.`, focusAgentIds: [a.id, ...ids], typeFilter: null };
		}
	}
	if (/\b(burn|burning|budget|slo)\b/.test(n)) {
		const ids = agents.filter((a) => a.service.burnRate > 1).map((a) => a.id);
		return { intent: "burning", title: "Burning services", summary: `${ids.length} owned services over budget.`, focusAgentIds: ids, typeFilter: "service" };
	}
	if (/\b(cost|spend|spending|expensive|money)\b/.test(n) || n.includes("$")) {
		const ids = [...agents].sort((a, b) => b.cost.current - a.cost.current).slice(0, 3).map((a) => a.id);
		return { intent: "cost", title: "Top spend", summary: "The 3 most expensive agents.", focusAgentIds: ids, typeFilter: "agent" };
	}
	if (/\b(autonomous|autonom|no human|unsupervised)\b/.test(n)) {
		const ids = agents.filter((a) => a.autonomyTier === "autonomous").map((a) => a.id);
		return { intent: "autonomy", title: "Autonomous agents", summary: `${ids.length} agents act with no human in the loop.`, focusAgentIds: ids, typeFilter: "agent" };
	}
	const matches = agents.filter((a) => norm(a.name).includes(n) || norm(a.service.name).includes(n));
	if (matches.length) return { intent: "fallback", title: `Matches for "${q}"`, summary: `${matches.length} entities match.`, focusAgentIds: matches.map((a) => a.id), typeFilter: null };
	return { intent: "fallback", title: `No match for "${q}"`, summary: "No entities matched — showing the full estate.", focusAgentIds: [], typeFilter: null };
}

export function chipFilter(chip: ChipType): WorldNodeType | null {
	return chip === "all" ? null : (chip as WorldNodeType);
}
