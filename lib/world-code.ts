// "World as code": turn a query slice into the artifact an agent plans against.
// toWorldModel = the simulator (Code World Models); toHarness = the minimal
// guard (AutoHarness). Pure string builders → deterministic + node-testable.

import type { SreAgent } from "./sre-data";
import type { QueryResult } from "./world-query";

function subjects(result: QueryResult, agents: SreAgent[]): SreAgent[] {
	const ids = result.focusAgentIds.length ? result.focusAgentIds : agents.slice(0, 3).map((a) => a.id);
	return ids.map((id) => agents.find((a) => a.id === id)).filter((a): a is SreAgent => !!a);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function toWorldModel(result: QueryResult, agents: SreAgent[]): string {
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
	const unreviewedAuton = subs.some((a) => a.autonomyTier === "autonomous" && a.reviewSamplingRate < 0.05);
	return [
		`// world slice · ${result.title}`,
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

export function toHarness(result: QueryResult, agents: SreAgent[]): string {
	const subs = subjects(result, agents);
	const burning = subs.find((a) => a.service.burnRate > 1)?.service.name ?? null;
	return [
		`// harness · ${result.title} — minimal code that keeps the agent valid`,
		`function legalActions(s) {`,
		`  return ALL.filter(a =>`,
		`    !mutatesProd(a) || s.reviewSamplingRate >= 0.05);   // coverage guard`,
		`}`,
		``,
		`function apply(a) {`,
		`  if (a.risk === "mutate" && a.blastInstances > 8) return needsHuman(a);`,
		burning ? `  if (burning(${JSON.stringify(burning)})) return block(a);   // over budget` : `  // no burning owned service in this slice`,
		`  return commit(a);`,
		`}`,
	].join("\n");
}
