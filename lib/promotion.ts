import type { AutonomyTier, ProvingEnv, SreAgent } from "@/lib/sre-data";

// Local copy (type-only import above keeps this module runtime-dependency-free so
// it runs under `node --test` type-stripping without the @/ alias resolving).
const MS_PER_HOUR = 3_600_000;

// ---------------------------------------------------------------------------
// Promotion engine — pure, framework-free, unit-testable. The credibility core
// of the SRE Promotion Engine: trust is EARNED from verifiable evidence and can
// be LOST. Nothing here touches React or the DOM.
// ---------------------------------------------------------------------------

export const TIERS: AutonomyTier[] = ["harnessed", "supervised", "guarded", "autonomous"];

export const TIER_RANK: Record<AutonomyTier, number> = {
	harnessed: 0,
	supervised: 1,
	guarded: 2,
	autonomous: 3,
};

export const TIER_LABEL: Record<AutonomyTier, string> = {
	harnessed: "HARNESSED",
	supervised: "SUPERVISED",
	guarded: "GUARDED",
	autonomous: "AUTONOMOUS",
};

export const TIER_MEANING: Record<AutonomyTier, string> = {
	harnessed: "Human approves every action",
	supervised: "Auto routine · human approves risky actions",
	guarded: "Full auto behind guardrails + auto-rollback",
	autonomous: "No human in any loop",
};

// Monochrome autonomy-fill ramp (NOT a health color) — percentage per tier.
export const AUTONOMY_FILL_PCT: Record<AutonomyTier, number> = {
	harnessed: 15,
	supervised: 45,
	guarded: 75,
	autonomous: 100,
};

export const ENV_ORDER: ProvingEnv[] = ["sandbox", "shadow", "canary", "production"];
export const ENV_RANK: Record<ProvingEnv, number> = { sandbox: 0, shadow: 1, canary: 2, production: 3 };
export const ENV_LABEL: Record<ProvingEnv, string> = {
	sandbox: "sandbox",
	shadow: "shadow",
	canary: "canary",
	production: "production",
};

export function nextTier(t: AutonomyTier): AutonomyTier | null {
	return TIERS[TIER_RANK[t] + 1] ?? null;
}
export function prevTier(t: AutonomyTier): AutonomyTier | null {
	return TIER_RANK[t] > 0 ? TIERS[TIER_RANK[t] - 1] : null;
}

// Gate definition for promoting INTO a target tier.
export type GateDef = {
	to: AutonomyTier;
	verifiedRuns: number;
	slo: number; // success-rate threshold (0-1)
	overrideMax: number; // max acceptable override rate (0-1)
	soakMs: number; // required dwell in current tier
	requiredEnv: ProvingEnv; // proving ground that must be reached
};

export const GATES: Record<AutonomyTier, GateDef> = {
	// keyed by the FROM tier; harnessed -> supervised, etc. autonomous has no gate.
	harnessed: { to: "supervised", verifiedRuns: 50, slo: 0.995, overrideMax: 0.05, soakMs: 2 * MS_PER_HOUR, requiredEnv: "shadow" },
	supervised: { to: "guarded", verifiedRuns: 250, slo: 0.999, overrideMax: 0.02, soakMs: 6 * MS_PER_HOUR, requiredEnv: "canary" },
	guarded: { to: "autonomous", verifiedRuns: 1000, slo: 0.9995, overrideMax: 0.005, soakMs: 12 * MS_PER_HOUR, requiredEnv: "production" },
	autonomous: { to: "autonomous", verifiedRuns: 0, slo: 1, overrideMax: 0, soakMs: 0, requiredEnv: "production" },
};

export function gateFor(tier: AutonomyTier): GateDef | null {
	return tier === "autonomous" ? null : GATES[tier];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const noCriticals = (a: SreAgent) => a.incidents === 0 && a.status !== "critical";

export type CriterionId = "runs" | "slo" | "override" | "criticals" | "soak" | "env";
export type CriterionKind = "count" | "pct" | "binary" | "time" | "env";

export type Criterion = {
	id: CriterionId;
	label: string;
	kind: CriterionKind;
	current: number;
	target: number;
	pass: boolean;
	inverted: boolean; // lower-is-better (override rate)
	fraction: number; // 0-1 progress toward target (for the fill bar)
	currentEnv?: ProvingEnv;
	requiredEnv?: ProvingEnv;
};

// The verifiable criteria for an agent's NEXT promotion. Derived, never stored.
export function gateProgress(a: SreAgent): Criterion[] {
	const g = gateFor(a.autonomyTier);
	if (!g) return [];
	return [
		{
			id: "runs",
			label: "verified runs",
			kind: "count",
			current: a.verifiedRuns,
			target: g.verifiedRuns,
			pass: a.verifiedRuns >= g.verifiedRuns,
			inverted: false,
			fraction: clamp01(a.verifiedRuns / g.verifiedRuns),
		},
		{
			id: "slo",
			label: "SLO adherence",
			kind: "pct",
			current: a.successRate * 100,
			target: g.slo * 100,
			pass: a.successRate >= g.slo && a.slo.burnRate <= 1,
			inverted: false,
			fraction: clamp01(a.successRate / g.slo),
		},
		{
			id: "override",
			label: "override rate",
			kind: "pct",
			current: a.overrideRate * 100,
			target: g.overrideMax * 100,
			pass: a.overrideRate <= g.overrideMax,
			inverted: true,
			// fills as override decays toward zero; full at 0, ~half at the limit
			fraction: clamp01(1 - a.overrideRate / Math.max(g.overrideMax * 2, 1e-6)),
		},
		{
			id: "criticals",
			label: "zero criticals",
			kind: "binary",
			current: a.incidents,
			target: 0,
			pass: noCriticals(a),
			inverted: false,
			fraction: noCriticals(a) ? 1 : 0,
		},
		{
			id: "soak",
			label: "soak in tier",
			kind: "time",
			current: a.soakMs,
			target: g.soakMs,
			pass: a.soakMs >= g.soakMs,
			inverted: false,
			fraction: clamp01(a.soakMs / g.soakMs),
		},
		{
			id: "env",
			label: "proving ground",
			kind: "env",
			current: ENV_RANK[a.provingEnv],
			target: ENV_RANK[g.requiredEnv],
			pass: ENV_RANK[a.provingEnv] >= ENV_RANK[g.requiredEnv],
			inverted: false,
			fraction: clamp01(ENV_RANK[a.provingEnv] / ENV_RANK[g.requiredEnv]),
			currentEnv: a.provingEnv,
			requiredEnv: g.requiredEnv,
		},
	];
}

// Weighted 0-100 readiness toward the next tier. A failing zero-criticals gate
// HARD-CAPS readiness near 60, so a single critical visibly tanks trust.
const WEIGHTS: Record<CriterionId, number> = { slo: 0.3, override: 0.25, runs: 0.2, soak: 0.15, criticals: 0.1, env: 0 };

export function computeReadiness(a: SreAgent): number {
	if (a.autonomyTier === "autonomous") return 100;
	const crit = gateProgress(a);
	// The meter hits exactly 100 the moment every criterion passes (= eligible).
	if (crit.every((c) => c.pass)) return 100;
	let score = 0;
	for (const c of crit) score += (WEIGHTS[c.id] ?? 0) * c.fraction;
	let pct = Math.round(score * 100);
	if (pct >= 100) pct = 99; // never show 100 unless actually eligible
	if (!noCriticals(a)) pct = Math.min(pct, 60);
	// env not reached also caps progress so readiness can't read "ready" while unproven
	const envOk = crit.find((c) => c.id === "env")?.pass ?? true;
	if (!envOk) pct = Math.min(pct, 85);
	return Math.max(0, Math.min(100, pct));
}

// Eligible to promote: a next tier exists and every criterion passes.
export function eligible(a: SreAgent): boolean {
	if (a.autonomyTier === "autonomous") return false;
	return gateProgress(a).every((c) => c.pass);
}

// The first unmet criterion (for the disabled-Promote tooltip), or null.
export function blockingReason(a: SreAgent): string | null {
	if (a.autonomyTier === "autonomous") return "already autonomous";
	const c = gateProgress(a).find((x) => !x.pass);
	if (!c) return null;
	if (c.id === "env") return `needs ${c.requiredEnv} (in ${c.currentEnv})`;
	if (c.id === "criticals") return "incident in soak window";
	if (c.id === "override") return `override ${c.current.toFixed(1)}% > ${c.target.toFixed(1)}%`;
	if (c.id === "soak") return "soak time not met";
	if (c.id === "slo") return `SLO ${c.current.toFixed(2)}% < ${c.target.toFixed(2)}%`;
	return `verified runs ${c.current}/${c.target}`;
}
