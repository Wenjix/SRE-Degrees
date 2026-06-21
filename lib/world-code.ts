// "World as code": turn a query slice into the artifact an agent plans against.
// toWorldModel = the simulator (Code World Models); toHarness = the minimal
// guard (AutoHarness). Pure string builders → deterministic + node-testable.

import type { Incident, SreAgent } from "./sre-data";
import type { QueryResult } from "./world-query";

// Minimum review coverage (0–1) below which a mutating prod action can't be
// trusted. Sourced once so the WORLD MODEL invariant and the HARNESS guard
// can't drift apart. (Mirrors the guarded→autonomous gate's samplingFloor in
// lib/promotion.ts; kept local to preserve this module's type-only imports.)
const REVIEW_FLOOR = 0.05;

function subjects(result: QueryResult, agents: SreAgent[]): SreAgent[] {
	const ids = result.focusAgentIds.length ? result.focusAgentIds : agents.slice(0, 3).map((a) => a.id);
	return ids.map((id) => agents.find((a) => a.id === id)).filter((a): a is SreAgent => !!a);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// incident provenance comments — tie the code slice back to the agent's journey
// (implicated in a fire, or recovered from one = the proving evidence).
function incidentNotes(subs: SreAgent[], incidents: Incident[]): string[] {
	const out: string[] = [];
	for (const a of subs) {
		// prefer an ACTIVE fire over a resolved one, so a recovered incident never
		// masks a live one in the provenance comment.
		const inc = incidents.find((i) => !i.resolved && i.agentIds.includes(a.id)) ?? incidents.find((i) => i.agentIds.includes(a.id));
		if (!inc) continue;
		out.push(
			inc.resolved
				? `// ${slug(a.name)} — recovered from ${inc.id} (${inc.service})`
				: `// ${slug(a.name)} — implicated in ${inc.id} (SEV${inc.severity})`,
		);
	}
	return out;
}

export function toWorldModel(result: QueryResult, agents: SreAgent[], incidents: Incident[] = []): string {
	const subs = subjects(result, agents);
	const nameOf = (id: string) => slug(agents.find((x) => x.id === id)?.name ?? id);
	const agentLines = subs
		.map((a) => `    ${slug(a.name)}: { tier: ${JSON.stringify(a.autonomyTier)}, owns: ${JSON.stringify(a.service.name)}, dependsOn: ${JSON.stringify(a.dependsOn.map(nameOf))} },`)
		.join("\n");
	const svc = new Map<string, SreAgent>();
	for (const a of subs) if (!svc.has(a.service.name)) svc.set(a.service.name, a);
	const svcLines = [...svc.values()]
		.map((a) => `    ${JSON.stringify(a.service.name)}: { sloTarget: ${a.service.sloTarget}, burnRate: ${a.service.burnRate}, budgetPct: ${a.service.errorBudgetPct} },`)
		.join("\n");
	const worstBurn = subs.reduce((m, a) => Math.max(m, a.service.burnRate), 0);
	const unreviewedAuton = subs.some((a) => a.autonomyTier === "autonomous" && a.reviewSamplingRate < REVIEW_FLOOR);
	return [
		`// world slice · ${result.title}`,
		...incidentNotes(subs, incidents),
		`const world = {`,
		`  agents: {`,
		agentLines,
		`  },`,
		`  services: {`,
		svcLines,
		`  },`,
		`};`,
		``,
		`// invariants the planner must preserve`,
		`inv(w => maxBurn(w) <= 1)   // ${worstBurn <= 1 ? "✓" : `✗ ${worstBurn}`}`,
		`inv(w => reviewed(w) || !autonomous(w))   // ${unreviewedAuton ? "✗" : "✓"}`,
		``,
		`function step(w, action) { /* next world */ }`,
	].join("\n");
}

export function toHarness(result: QueryResult, agents: SreAgent[], incidents: Incident[] = []): string {
	const subs = subjects(result, agents);
	const burning = subs.find((a) => a.service.burnRate > 1)?.service.name ?? null;
	return [
		`// harness · ${result.title} — minimal code that keeps the agent valid`,
		...incidentNotes(subs, incidents),
		`function legalActions(s) {`,
		`  return ALL.filter(a =>`,
		`    !mutatesProd(a) || s.reviewSamplingRate >= ${REVIEW_FLOOR});   // coverage guard`,
		`}`,
		``,
		`function apply(a) {`,
		`  if (a.risk === "mutate" && a.blastInstances > 8) return needsHuman(a);`,
		burning ? `  if (burning(${JSON.stringify(burning)})) return block(a);   // over budget` : `  // no burning owned service in this slice`,
		`  return commit(a);`,
		`}`,
	].join("\n");
}
