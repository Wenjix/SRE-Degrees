// Fleet Risk & Economics — the VP telescope.
//
// Pure, framework-free derivations over the live agent list: spend, oversight
// distribution, concentrated-authority (blast-correlation) detection, owner
// attribution, and the owned-service budget portfolio. Same discipline as
// lib/promotion.ts — type-only imports, no React, unit-testable under node --test.

import type { AutonomyTier, SreAgent, Tier } from "./sre-data";

export const TIER_ORDER: AutonomyTier[] = ["harnessed", "supervised", "guarded", "autonomous"];

// $/hr at which an agent is flagged as burning money — matches the AgentCard runaway tell.
export const RUNAWAY_COST = 25;

const HIGH = (t: AutonomyTier) => t === "guarded" || t === "autonomous";
// the tools that change the world (vs. route/observe/page) — what makes blast real.
const MUTATING_TOOL = new Set(["scale", "heal", "lock"]);
const canMutate = (a: SreAgent) => a.tools.some((t) => MUTATING_TOOL.has(t.id));

// Frozen prior-week snapshot so week-over-week deltas are stable narrative, not
// telemetry jitter. Hermes crossed into AUTONOMOUS this week (guarded 3 -> 2,
// autonomous 0 -> 1); spend is up as a runaway query-cache grows.
export const FLEET_PRIOR_WEEK = {
	costHr: 129,
	byTier: { harnessed: 4, supervised: 7, guarded: 3, autonomous: 0 } as Record<AutonomyTier, number>,
	overrideRate: 0.031,
	autoDemotions: 1,
};

// Who owns each tier's risk — the "who do I talk to" column.
export const TEAM_LEAD: Record<string, string> = {
	"core-tier": "rivera",
	"edge-tier": "okafor",
	"data-tier": "chen",
	"batch-tier": "santos",
};

const sum = (list: SreAgent[], f: (a: SreAgent) => number) => list.reduce((s, a) => s + f(a), 0);
const round = (n: number, d = 0) => {
	const p = 10 ** d;
	return Math.round(n * p) / p;
};
const pctDelta = (now: number, prior: number) => (prior === 0 ? 0 : round(((now - prior) / prior) * 100, 0));

// --- Economics --------------------------------------------------------------
export type Economics = {
	costHr: number;
	costDeltaPct: number; // vs prior week
	tokensPerMin: number;
	actionsPerMin: number;
	costPerKActions: number; // $ per 1,000 actions — spend efficiency
	runaway: { name: string; costHr: number; service: string }[];
	byTeam: { team: string; costHr: number }[]; // desc
	topSpenders: { name: string; costHr: number; service: string }[]; // desc, top 3
};

export function fleetEconomics(list: SreAgent[]): Economics {
	const costHr = round(sum(list, (a) => a.cost.current), 0);
	const actionsPerMin = round(sum(list, (a) => a.actions.current), 0);
	const actionsPerHrK = (actionsPerMin * 60) / 1000;
	const teams = [...new Set(list.map((a) => a.org))];
	return {
		costHr,
		costDeltaPct: pctDelta(costHr, FLEET_PRIOR_WEEK.costHr),
		tokensPerMin: sum(list, (a) => a.tokensPerMin),
		actionsPerMin,
		costPerKActions: actionsPerHrK > 0 ? round(costHr / actionsPerHrK, 2) : 0,
		runaway: list
			.filter((a) => a.cost.current >= RUNAWAY_COST)
			.sort((a, b) => b.cost.current - a.cost.current)
			.map((a) => ({ name: a.name, costHr: round(a.cost.current, 0), service: a.service.name })),
		byTeam: teams
			.map((team) => ({ team, costHr: round(sum(list.filter((a) => a.org === team), (a) => a.cost.current), 0) }))
			.sort((a, b) => b.costHr - a.costHr),
		topSpenders: [...list]
			.sort((a, b) => b.cost.current - a.cost.current)
			.slice(0, 3)
			.map((a) => ({ name: a.name, costHr: round(a.cost.current, 0), service: a.service.name })),
	};
}

// --- Oversight / governance -------------------------------------------------
export type Governance = {
	byTier: Record<AutonomyTier, number>;
	priorByTier: Record<AutonomyTier, number>;
	netLadderSteps: number; // net up-the-ladder movement vs prior week
	autonomousInProd: string[]; // names — agents with NO human in any loop, on real traffic
	highAutonomyInProd: number; // guarded+ in production (the risk surface)
	inCooldown: number; // agents currently recovering trust after a demotion
	autoDemotions7d: number;
	fleetOverrideRate: number; // action-weighted (the honest denominator)
	overrideDeltaPct: number;
};

const ladderScore = (byTier: Record<AutonomyTier, number>) =>
	TIER_ORDER.reduce((s, t, i) => s + i * (byTier[t] ?? 0), 0);

export function fleetGovernance(list: SreAgent[]): Governance {
	const byTier = { harnessed: 0, supervised: 0, guarded: 0, autonomous: 0 } as Record<AutonomyTier, number>;
	for (const a of list) byTier[a.autonomyTier] += 1;

	const actions = sum(list, (a) => a.actions.current);
	const fleetOverrideRate = actions > 0 ? sum(list, (a) => a.overrideRate * a.actions.current) / actions : 0;

	return {
		byTier,
		priorByTier: FLEET_PRIOR_WEEK.byTier,
		netLadderSteps: ladderScore(byTier) - ladderScore(FLEET_PRIOR_WEEK.byTier),
		autonomousInProd: list
			.filter((a) => a.autonomyTier === "autonomous" && a.provingEnv === "production")
			.map((a) => a.name),
		highAutonomyInProd: list.filter((a) => HIGH(a.autonomyTier) && a.provingEnv === "production").length,
		inCooldown: list.filter((a) => a.cooldown > 0).length,
		autoDemotions7d: FLEET_PRIOR_WEEK.autoDemotions,
		fleetOverrideRate: round(fleetOverrideRate, 4),
		overrideDeltaPct: pctDelta(fleetOverrideRate, FLEET_PRIOR_WEEK.overrideRate),
	};
}

// --- Correlated authority (blast correlation) -------------------------------
// Where a single bad decision blasts wide: dependency hubs, unsupervised agents
// sitting upstream of critical paths, and clusters of high-autonomy mutate power.
export type AuthorityRisk = {
	id: string;
	kind: "hub" | "autonomous-upstream" | "shared-mutate";
	title: string;
	detail: string;
	agents: string[];
	high: boolean; // ordering + emphasis only — never a color
};

export function correlatedAuthority(list: SreAgent[]): AuthorityRisk[] {
	const byId = new Map(list.map((a) => [a.id, a]));
	const name = (id: string) => byId.get(id)?.name ?? id;
	const risks: AuthorityRisk[] = [];

	// dependents per agent id
	const dependents = new Map<string, string[]>();
	for (const a of list) for (const d of a.dependsOn) dependents.set(d, [...(dependents.get(d) ?? []), a.id]);

	for (const [hubId, deps] of dependents) {
		const hub = byId.get(hubId);
		if (!hub || deps.length < 2) continue;
		const burning = hub.service.burnRate > 1;
		const crit = hub.status === "critical";
		risks.push({
			id: `hub-${hubId}`,
			kind: "hub",
			title: `${hub.name} · ${deps.length} agents depend on it`,
			detail: crit || burning
				? `${hub.name} is ${crit ? "CRITICAL" : `burning ${hub.service.burnRate}×`} on ${hub.service.name} — failure cascades to ${deps.map(name).join(", ")}.`
				: `A failure in ${hub.name} (${hub.service.name}) propagates to ${deps.map(name).join(", ")}.`,
			agents: [hub.name, ...deps.map(name)],
			high: crit || burning,
		});
	}

	// autonomous agents sitting upstream of anything (no human in their loop)
	for (const a of list) {
		if (a.autonomyTier !== "autonomous") continue;
		const deps = dependents.get(a.id);
		if (!deps?.length) continue;
		risks.push({
			id: `auto-${a.id}`,
			kind: "autonomous-upstream",
			title: `${a.name} runs autonomous, upstream of ${deps.length}`,
			detail: `${a.name} acts with no human in any loop and is a dependency of ${deps.map(name).join(", ")}.`,
			agents: [a.name, ...deps.map(name)],
			high: deps.some((d) => byId.get(d)?.status === "critical"),
		});
	}

	// clusters of high-autonomy mutate power in one zone
	const zones = [...new Set(list.map((a) => a.zone))] as Tier[];
	for (const z of zones) {
		const movers = list.filter((a) => a.zone === z && HIGH(a.autonomyTier) && canMutate(a));
		if (movers.length < 2) continue;
		risks.push({
			id: `mutate-${z}`,
			kind: "shared-mutate",
			title: `${movers.length} guarded+ agents can mutate ${z}`,
			detail: `${movers.map((a) => a.name).join(", ")} each hold mutating authority in the ${z} zone with minimal review.`,
			agents: movers.map((a) => a.name),
			high: false,
		});
	}

	return risks.sort((a, b) => Number(b.high) - Number(a.high) || a.kind.localeCompare(b.kind));
}

// --- Owner attribution ------------------------------------------------------
export type OwnerRow = {
	team: string;
	lead: string;
	agents: number;
	highAutonomy: number;
	costHr: number;
	criticals: number;
	burningSvcs: number;
};

export function ownershipRollup(list: SreAgent[]): OwnerRow[] {
	const teams = [...new Set(list.map((a) => a.org))];
	return teams
		.map((team) => {
			const g = list.filter((a) => a.org === team);
			return {
				team,
				lead: TEAM_LEAD[team] ?? "unassigned",
				agents: g.length,
				highAutonomy: g.filter((a) => HIGH(a.autonomyTier)).length,
				costHr: round(sum(g, (a) => a.cost.current), 0),
				criticals: g.filter((a) => a.status === "critical").length,
				burningSvcs: g.filter((a) => a.service.burnRate > 1).length,
			};
		})
		.sort((a, b) => b.criticals - a.criticals || b.highAutonomy - a.highAutonomy || b.costHr - a.costHr);
}

// --- Owned-service budget portfolio -----------------------------------------
export type BudgetPortfolio = {
	burning: { service: string; burnRate: number; team: string }[]; // desc
	withinBudget: number;
};

export function budgetPortfolio(list: SreAgent[]): BudgetPortfolio {
	return {
		burning: list
			.filter((a) => a.service.burnRate > 1)
			.sort((a, b) => b.service.burnRate - a.service.burnRate)
			.map((a) => ({ service: a.service.name, burnRate: round(a.service.burnRate, 1), team: a.org })),
		withinBudget: list.filter((a) => a.service.burnRate <= 1).length,
	};
}
