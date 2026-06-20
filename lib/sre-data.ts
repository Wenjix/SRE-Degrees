import type { CommandEntity, StatusTone } from "@/lib/navigation";

// ---------------------------------------------------------------------------
// RETICLE // SECTOR — SRE agent domain model
// A bounded, grid-quantized spatial board. Positions are world pixels, always
// multiples of CELL (48). Which ZoneField an agent's CENTER falls inside is its
// primary service grouping; proximity within a zone derives sub-clusters.
// ---------------------------------------------------------------------------

export type AgentStatus = "healthy" | "degraded" | "critical" | "idle";
export type Tier = "edge" | "core" | "data" | "batch";

// --- Autonomy / Promotion Engine ------------------------------------------
export type AutonomyTier = "harnessed" | "supervised" | "guarded" | "autonomous";
export type ProvingEnv = "sandbox" | "shadow" | "canary" | "production";

export type MetricSeries = {
	current: number;
	unit: string;
	series: number[]; // recent samples, oldest -> newest
};

export type AgentToolIcon =
	| "route"
	| "observe"
	| "heal"
	| "page"
	| "scale"
	| "data"
	| "lock"
	| "sync";

export type AgentTool = {
	id: string;
	icon: AgentToolIcon;
	label: string;
	active?: boolean;
};

export type SreAgent = {
	id: string; // machine id, e.g. 'sre-7f2a'
	name: string; // 'Atlas'
	host: string; // 'atlas-prod'
	org: string; // 'core-tier'
	region: string; // 'us-east-1'
	zone: Tier; // home zone (primary grouping)
	status: AgentStatus;
	tone: StatusTone; // reuse existing tone -> color mapping
	pos: { x: number; y: number }; // world coords, CELL-quantized
	slo: { burnRate: number; target: number }; // the AGENT's own reliability (burnRate>1 = burning)
	errorBudget: { remainingPct: number };
	// --- agent-native work signals (golden signals for an AGENT, not a VM) ---
	actions: MetricSeries; // actions / min (traffic)
	toolSuccess: MetricSeries; // tool-call success % (errors)
	decisionMs: MetricSeries; // decision latency p95, ms (latency)
	cost: MetricSeries; // $ / hr — the second budget a VP manages
	tokensPerMin: number;
	// the SERVICE this agent is responsible for; its budget is INDEPENDENT of the
	// agent's own health (a healthy agent can sit over a burning service).
	service: { name: string; sloTarget: number; burnRate: number; errorBudgetPct: number };
	// host vitals — relegated; surfaced only in the L3 dossier's Host section.
	cpu: MetricSeries;
	mem: MetricSeries;
	disk: MetricSeries;
	latencyMs: number;
	heartbeat: { intervalMs: number; ticks: number[] };
	tools: AgentTool[];
	mcpServers: string[];
	cron: { label: string; etaMin: number }[];
	dependsOn: string[];
	terminalLines: string[];
	uptime: string;
	// --- autonomy / promotion ---
	autonomyTier: AutonomyTier;
	readiness: number; // 0-100, slew-limited, recomputed by lib/promotion.ts
	provingEnv: ProvingEnv;
	verifiedRuns: number;
	successRate: number; // 0-1 rolling
	overrideRate: number; // 0-1 human-correction rate (only meaningful given review coverage)
	evalPassRate: number; // 0-1 decision-quality eval suite pass rate
	humanAgreementRate: number; // 0-1 agreement on sampled decisions
	reviewSamplingRate: number; // 0-1 fraction of actions still human-reviewed (the override DENOMINATOR)
	incidents: number; // criticals in the current soak window
	soakMs: number; // accumulated sim-time in the current tier
	critStreak: number; // consecutive critical ticks (sim-managed)
	cooldown: number; // ticks until eligible for auto-demote again
};

export const MS_PER_HOUR = 3_600_000;

// --- Spatial constants (shared by data, canvas, hooks) ---------------------
export const CELL = 48;
export const CARD_W = 288; // 6 cells
export const CARD_H = 240; // 5 cells
export const WORLD = { width: 1512, height: 1224 };

export type ZoneDef = {
	id: Tier;
	title: string;
	tier: number;
	rect: { x: number; y: number; w: number; h: number };
};

export const zones: ZoneDef[] = [
	{ id: "edge", title: "EDGE", tier: 1, rect: { x: 24, y: 24, w: 672, h: 576 } },
	{ id: "core", title: "CORE", tier: 0, rect: { x: 792, y: 24, w: 672, h: 576 } },
	{ id: "data", title: "DATA", tier: 1, rect: { x: 24, y: 624, w: 672, h: 576 } },
	{ id: "batch", title: "BATCH", tier: 2, rect: { x: 792, y: 624, w: 672, h: 576 } },
];

export function toneForStatus(status: AgentStatus): StatusTone {
	switch (status) {
		case "healthy":
			return "ok";
		case "degraded":
			return "warn";
		case "critical":
			return "error";
		default:
			return "neutral";
	}
}

export const STATUS_RANK: Record<AgentStatus, number> = {
	critical: 3,
	degraded: 2,
	healthy: 1,
	idle: 0,
};

// Deterministic series so SSR and first client render match (no Math.random at
// module scope). The live TelemetrySimulator mutates these after mount.
function series(base: number, amp: number, phase: number, n = 24): number[] {
	return Array.from({ length: n }, (_, i) => {
		const v = base + Math.sin(i / 2.3 + phase) * amp + ((i % 4) - 1.5) * amp * 0.18;
		return Math.round(Math.max(0, v) * 100) / 100;
	});
}

function hb(phase: number, n = 20): number[] {
	return Array.from({ length: n }, (_, i) => Math.round((1 + Math.sin(i + phase) * 0.12) * 1000) / 1000);
}

type Seed = {
	id: string;
	name: string;
	host: string;
	zone: Tier;
	status: AgentStatus;
	pos: [number, number];
	cpu: number;
	mem: number;
	disk: number;
	latencyMs: number;
	burn: number;
	budget: number;
	region: string;
	tools: AgentTool[];
	mcp: string[];
	cron: { label: string; etaMin: number }[];
	dependsOn: string[];
	tail: string[];
	uptime: string;
};

const T = (id: string, icon: AgentToolIcon, label: string, active = false): AgentTool => ({ id, icon, label, active });

const ORG: Record<Tier, string> = {
	edge: "edge-tier",
	core: "core-tier",
	data: "data-tier",
	batch: "batch-tier",
};

const SEEDS: Seed[] = [
	// ---- EDGE (tier-1): one degraded -------------------------------------
	{
		id: "sre-9c1f", name: "Nyx", host: "nyx-edge", zone: "edge", status: "degraded",
		pos: [48, 48], cpu: 0.6, mem: 196, disk: 1.4, latencyMs: 268, burn: 1.7, budget: 38,
		region: "eu-west-1",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe", true), T("heal", "heal", "Self-heal"), T("page", "page", "Page")],
		mcp: ["cdn-control", "geo-router"], cron: [{ label: "purge-cache", etaMin: 6 }],
		dependsOn: ["sre-7f2a"],
		tail: ["$ nyx heartbeat", "probe edge-3 SLOW 268ms", "retry pop-fra-1 ...", "cron: purge-cache 6m", "MCP: 2 servers connected"],
		uptime: "up 2d 7h",
	},
	{
		id: "sre-3a07", name: "Pan", host: "pan-edge", zone: "edge", status: "healthy",
		pos: [384, 48], cpu: 0.3, mem: 128, disk: 0.9, latencyMs: 96, burn: 0.4, budget: 94,
		region: "eu-west-1",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe"), T("scale", "scale", "Scale")],
		mcp: ["cdn-control"], cron: [{ label: "rotate-keys", etaMin: 44 }],
		dependsOn: [],
		tail: ["$ pan heartbeat", "probe edge-7 ok", "4,102 checks/min", "cron: rotate-keys 44m", "MCP: 1 server connected"],
		uptime: "up 9d 1h",
	},
	{
		id: "sre-5d2b", name: "Eos", host: "eos-edge", zone: "edge", status: "healthy",
		pos: [48, 336], cpu: 0.4, mem: 152, disk: 1.1, latencyMs: 112, burn: 0.6, budget: 88,
		region: "us-west-2",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe"), T("page", "page", "Page")],
		mcp: ["geo-router"], cron: [{ label: "warm-pops", etaMin: 18 }],
		dependsOn: [],
		tail: ["$ eos heartbeat", "probe edge-1 ok", "3,860 checks/min", "cron: warm-pops 18m", "MCP: 1 server connected"],
		uptime: "up 5d 12h",
	},
	{
		id: "sre-1e44", name: "Boreas", host: "boreas-edge", zone: "edge", status: "healthy",
		pos: [384, 336], cpu: 0.35, mem: 140, disk: 1.0, latencyMs: 104, burn: 0.5, budget: 91,
		region: "ap-south-1",
		tools: [T("route", "route", "Route"), T("scale", "scale", "Scale")],
		mcp: ["cdn-control"], cron: [{ label: "trim-logs", etaMin: 30 }],
		dependsOn: [],
		tail: ["$ boreas heartbeat", "probe edge-9 ok", "3,540 checks/min", "cron: trim-logs 30m", "MCP: 1 server connected"],
		uptime: "up 12d 3h",
	},
	// ---- CORE (tier-0): one critical -------------------------------------
	{
		id: "sre-7f2a", name: "Atlas", host: "atlas-prod", zone: "core", status: "critical",
		pos: [816, 48], cpu: 0.92, mem: 412, disk: 2.1, latencyMs: 540, burn: 4.2, budget: 6,
		region: "us-east-1",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe", true), T("heal", "heal", "Self-heal", true), T("page", "page", "Page", true), T("scale", "scale", "Scale")],
		mcp: ["control-plane", "pager", "scheduler"], cron: [{ label: "rotate-certs", etaMin: 12 }],
		dependsOn: ["sre-2b90", "sre-6c18"],
		tail: ["$ atlas heartbeat", "probe core-2 FAIL x3", "error budget burning 4.2x", "paging on-call ...", "cron: rotate-certs 12m"],
		uptime: "up 4d 12h",
	},
	{
		id: "sre-4c2d", name: "Hera", host: "hera-prod", zone: "core", status: "healthy",
		pos: [1152, 48], cpu: 0.5, mem: 256, disk: 1.8, latencyMs: 142, burn: 0.7, budget: 82,
		region: "us-east-1",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe"), T("scale", "scale", "Scale"), T("lock", "lock", "Secrets")],
		mcp: ["control-plane", "vault"], cron: [{ label: "compact-state", etaMin: 22 }],
		dependsOn: ["sre-7f2a"],
		tail: ["$ hera heartbeat", "probe core-5 ok", "consensus quorum 5/5", "cron: compact-state 22m", "MCP: 2 servers connected"],
		uptime: "up 8d 6h",
	},
	{
		id: "sre-8a13", name: "Zeus", host: "zeus-prod", zone: "core", status: "healthy",
		pos: [816, 336], cpu: 0.55, mem: 288, disk: 2.0, latencyMs: 158, burn: 0.8, budget: 79,
		region: "us-east-2",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe"), T("heal", "heal", "Self-heal"), T("scale", "scale", "Scale")],
		mcp: ["control-plane", "scheduler"], cron: [{ label: "rebalance", etaMin: 9 }],
		dependsOn: ["sre-7f2a"],
		tail: ["$ zeus heartbeat", "probe core-8 ok", "rebalance shard 3 ok", "cron: rebalance 9m", "MCP: 2 servers connected"],
		uptime: "up 6d 19h",
	},
	{
		id: "sre-2b90", name: "Hermes", host: "hermes-prod", zone: "core", status: "healthy",
		pos: [1152, 336], cpu: 0.42, mem: 224, disk: 1.6, latencyMs: 128, burn: 0.6, budget: 86,
		region: "us-east-1",
		tools: [T("route", "route", "Route"), T("observe", "observe", "Observe"), T("page", "page", "Page")],
		mcp: ["control-plane", "pager"], cron: [{ label: "flush-queue", etaMin: 15 }],
		dependsOn: [],
		tail: ["$ hermes heartbeat", "probe core-1 ok", "4,281 events/min", "cron: flush-queue 15m", "MCP: 2 servers connected"],
		uptime: "up 11d 2h",
	},
	// ---- DATA (tier-1) ---------------------------------------------------
	{
		id: "sre-6c18", name: "Iris", host: "iris-data", zone: "data", status: "healthy",
		pos: [48, 624], cpu: 0.6, mem: 320, disk: 4.7, latencyMs: 188, burn: 0.9, budget: 74,
		region: "us-east-1",
		tools: [T("data", "data", "Pipelines", true), T("observe", "observe", "Observe"), T("scale", "scale", "Scale"), T("sync", "sync", "Sync")],
		mcp: ["warehouse", "lakehouse"], cron: [{ label: "compact-parquet", etaMin: 27 }],
		dependsOn: [],
		tail: ["$ iris heartbeat", "ingest batch-44 ok", "2.1M rows written", "cron: compact-parquet 27m", "MCP: 2 servers connected"],
		uptime: "up 7d 9h",
	},
	{
		id: "sre-0d77", name: "Juno", host: "juno-data", zone: "data", status: "healthy",
		pos: [384, 624], cpu: 0.48, mem: 280, disk: 3.9, latencyMs: 172, burn: 0.7, budget: 81,
		region: "us-east-2",
		tools: [T("data", "data", "Pipelines"), T("sync", "sync", "Sync", true), T("observe", "observe", "Observe")],
		mcp: ["warehouse"], cron: [{ label: "sync-feeds", etaMin: 11 }],
		dependsOn: ["sre-6c18"],
		tail: ["$ juno heartbeat", "sync feed-9 ok", "lag 0.4s", "cron: sync-feeds 11m", "MCP: 1 server connected"],
		uptime: "up 3d 14h",
	},
	{
		id: "sre-b3e1", name: "Vela", host: "vela-data", zone: "data", status: "healthy",
		pos: [48, 912], cpu: 0.52, mem: 300, disk: 4.1, latencyMs: 196, burn: 0.8, budget: 77,
		region: "ap-south-1",
		tools: [T("data", "data", "Pipelines"), T("lock", "lock", "Secrets"), T("observe", "observe", "Observe")],
		mcp: ["lakehouse", "vault"], cron: [{ label: "vacuum", etaMin: 38 }],
		dependsOn: ["sre-6c18"],
		tail: ["$ vela heartbeat", "query p95 196ms", "cache hit 94%", "cron: vacuum 38m", "MCP: 2 servers connected"],
		uptime: "up 10d 0h",
	},
	// ---- BATCH (tier-2): idle pool --------------------------------------
	{
		id: "sre-cf60", name: "Cron", host: "cron-batch", zone: "batch", status: "idle",
		pos: [816, 624], cpu: 0.05, mem: 64, disk: 0.6, latencyMs: 0, burn: 0.0, budget: 100,
		region: "us-east-1",
		tools: [T("sync", "sync", "Sync"), T("data", "data", "Pipelines")],
		mcp: ["scheduler"], cron: [{ label: "nightly-roll", etaMin: 182 }],
		dependsOn: [],
		tail: ["$ cron idle", "next: nightly-roll 3h", "0 jobs running", "MCP: 1 server connected"],
		uptime: "up 21d 8h",
	},
	{
		id: "sre-a4d8", name: "Sweep", host: "sweep-batch", zone: "batch", status: "idle",
		pos: [1152, 624], cpu: 0.04, mem: 56, disk: 0.5, latencyMs: 0, burn: 0.0, budget: 100,
		region: "us-west-2",
		tools: [T("sync", "sync", "Sync"), T("heal", "heal", "Self-heal")],
		mcp: ["scheduler"], cron: [{ label: "gc-orphans", etaMin: 95 }],
		dependsOn: [],
		tail: ["$ sweep idle", "next: gc-orphans 95m", "0 jobs running", "MCP: 1 server connected"],
		uptime: "up 18d 4h",
	},
	{
		id: "sre-7e22", name: "Reaper", host: "reaper-batch", zone: "batch", status: "idle",
		pos: [816, 912], cpu: 0.03, mem: 48, disk: 0.4, latencyMs: 0, burn: 0.0, budget: 100,
		region: "eu-west-1",
		tools: [T("heal", "heal", "Self-heal"), T("lock", "lock", "Secrets")],
		mcp: ["scheduler"], cron: [{ label: "expire-tokens", etaMin: 240 }],
		dependsOn: [],
		tail: ["$ reaper idle", "next: expire-tokens 4h", "0 jobs running", "MCP: 1 server connected"],
		uptime: "up 30d 11h",
	},
];

// Autonomy seed: per-agent overrides for the demo narrative + status defaults.
type AutoSeed = {
	tier: AutonomyTier;
	env: ProvingEnv;
	verifiedRuns: number;
	successRate: number;
	overrideRate: number;
	incidents: number;
	soakH: number;
	readiness: number;
};

const AUTONOMY_OVERRIDE: Record<string, AutoSeed> = {
	// Atlas — the jailed cautionary tale: critical, low trust, cannot advance.
	"sre-7f2a": { tier: "harnessed", env: "sandbox", verifiedRuns: 12, successRate: 0.93, overrideRate: 0.22, incidents: 2, soakH: 0.5, readiness: 22 },
	// Pan — the demo hero: supervised, sitting just under the guarded gate.
	"sre-3a07": { tier: "supervised", env: "canary", verifiedRuns: 244, successRate: 0.9992, overrideRate: 0.006, incidents: 0, soakH: 5.8, readiness: 92 },
	// Hera — primed for the REMOVE OVERSIGHT signature beat (guarded -> autonomous).
	"sre-4c2d": { tier: "guarded", env: "production", verifiedRuns: 994, successRate: 0.9997, overrideRate: 0.001, incidents: 0, soakH: 11.6, readiness: 96 },
	// Hermes — already autonomous; anchors the right edge.
	"sre-2b90": { tier: "autonomous", env: "production", verifiedRuns: 1820, successRate: 0.9998, overrideRate: 0, incidents: 0, soakH: 96, readiness: 100 },
	// Zeus — mid-journey at guarded.
	"sre-8a13": { tier: "guarded", env: "canary", verifiedRuns: 540, successRate: 0.9991, overrideRate: 0.004, incidents: 0, soakH: 4, readiness: 71 },
	// Nyx — degraded, held at supervised.
	"sre-9c1f": { tier: "supervised", env: "shadow", verifiedRuns: 96, successRate: 0.991, overrideRate: 0.05, incidents: 1, soakH: 2.5, readiness: 48 },
};

function autoSeedFor(s: Seed): AutoSeed {
	const o = AUTONOMY_OVERRIDE[s.id];
	if (o) return o;
	if (s.status === "idle") return { tier: "harnessed", env: "sandbox", verifiedRuns: 6, successRate: 0.97, overrideRate: 0.16, incidents: 0, soakH: 1, readiness: 24 };
	if (s.status === "degraded") return { tier: "supervised", env: "shadow", verifiedRuns: 110, successRate: 0.991, overrideRate: 0.05, incidents: 0, soakH: 2.5, readiness: 52 };
	return { tier: "supervised", env: "shadow", verifiedRuns: 150, successRate: 0.9985, overrideRate: 0.02, incidents: 0, soakH: 4.5, readiness: 66 };
}

// Honest-model seed: the service each agent owns, its agent-native work signals,
// and its oversight integrity (eval + review coverage). Most derives from
// status/tier; per-id overrides carry the narrative beats.
const SERVICE_NAME: Record<string, string> = {
	"sre-7f2a": "control-plane-api", "sre-4c2d": "consensus-store", "sre-8a13": "payments-ledger", "sre-2b90": "event-bus",
	"sre-3a07": "edge-router", "sre-9c1f": "cdn-cache", "sre-5d2b": "pop-fleet-eu", "sre-1e44": "pop-fleet-ap",
	"sre-6c18": "ingest-pipeline", "sre-0d77": "feed-sync", "sre-b3e1": "query-cache",
	"sre-cf60": "nightly-jobs", "sre-a4d8": "gc-sweeper", "sre-7e22": "token-expiry",
};

type WorkSeed = {
	actionsPerMin: number;
	toolSuccessPct: number;
	decisionMs: number;
	costHr: number;
	tokensPerMin: number;
	serviceBurn: number; // the owned SERVICE's burn (independent of agent health)
	serviceBudget: number;
	evalPassRate: number;
	humanAgreementRate: number;
	reviewSamplingRate: number;
};

// Review coverage falls as autonomy rises — which is exactly why a low
// correction-rate can't be trusted without checking the sampling denominator.
const SAMPLING_BY_TIER: Record<AutonomyTier, number> = {
	harnessed: 0.9, supervised: 0.45, guarded: 0.12, autonomous: 0.03,
};

const WORK_OVERRIDE: Record<string, Partial<WorkSeed>> = {
	// Zeus — a HEALTHY agent sitting over a BURNING service, and barely reviewed:
	// demonstrates the agent/service split AND the unwatched-gate fix (blocked).
	"sre-8a13": { serviceBurn: 3.8, serviceBudget: 7, reviewSamplingRate: 0.03, evalPassRate: 0.94 },
	// Vela — runaway cost: looks green, but silently burning money (silent failure).
	"sre-b3e1": { costHr: 52, tokensPerMin: 14200 },
	// Atlas — owned service on fire (correlated) + poor decision quality: stays jailed.
	"sre-7f2a": { serviceBurn: 4.2, serviceBudget: 6, evalPassRate: 0.86, costHr: 27, tokensPerMin: 9300 },
	// heroes keep clean services + adequate review coverage so they stay promotable
	"sre-3a07": { serviceBurn: 0.4, serviceBudget: 95, evalPassRate: 0.992, reviewSamplingRate: 0.46 },
	"sre-4c2d": { serviceBurn: 0.6, serviceBudget: 88, evalPassRate: 0.997, reviewSamplingRate: 0.14 },
	"sre-2b90": { serviceBurn: 0.5, serviceBudget: 90, evalPassRate: 0.999 },
};

function workSeedFor(s: Seed, auto: AutoSeed): WorkSeed {
	const sampling = SAMPLING_BY_TIER[auto.tier];
	const base: WorkSeed =
		s.status === "critical"
			? { actionsPerMin: 22, toolSuccessPct: 90, decisionMs: 820, costHr: 24, tokensPerMin: 8600, serviceBurn: s.burn, serviceBudget: s.budget, evalPassRate: 0.9, humanAgreementRate: 0.9, reviewSamplingRate: sampling }
			: s.status === "degraded"
				? { actionsPerMin: 34, toolSuccessPct: 96.5, decisionMs: 360, costHr: 11, tokensPerMin: 4200, serviceBurn: s.burn, serviceBudget: s.budget, evalPassRate: 0.95, humanAgreementRate: 0.93, reviewSamplingRate: sampling }
				: s.status === "idle"
					? { actionsPerMin: 0, toolSuccessPct: 100, decisionMs: 0, costHr: 0.4, tokensPerMin: 60, serviceBurn: 0, serviceBudget: 100, evalPassRate: 0.9, humanAgreementRate: 0.95, reviewSamplingRate: sampling }
					: { actionsPerMin: 58, toolSuccessPct: 99.4, decisionMs: 240, costHr: 7, tokensPerMin: 2600, serviceBurn: s.burn, serviceBudget: s.budget, evalPassRate: 0.98, humanAgreementRate: 0.97, reviewSamplingRate: sampling };
	return { ...base, ...WORK_OVERRIDE[s.id] };
}

export const agents: SreAgent[] = SEEDS.map((s, i) => {
	const auto = autoSeedFor(s);
	const w = workSeedFor(s, auto);
	return {
		id: s.id,
		name: s.name,
		host: s.host,
		org: ORG[s.zone],
		region: s.region,
		zone: s.zone,
		status: s.status,
		tone: toneForStatus(s.status),
		pos: { x: s.pos[0], y: s.pos[1] },
		slo: { burnRate: s.burn, target: 99.9 },
		errorBudget: { remainingPct: s.budget },
		actions: { current: w.actionsPerMin, unit: "/min", series: series(w.actionsPerMin, Math.max(2, w.actionsPerMin * 0.22), i + 6) },
		toolSuccess: { current: w.toolSuccessPct, unit: "%", series: series(w.toolSuccessPct, 0.5, i + 7) },
		decisionMs: { current: w.decisionMs, unit: "ms", series: series(w.decisionMs, Math.max(8, w.decisionMs * 0.18), i + 8) },
		cost: { current: w.costHr, unit: "$/hr", series: series(w.costHr, Math.max(0.3, w.costHr * 0.18), i + 9) },
		tokensPerMin: w.tokensPerMin,
		service: { name: SERVICE_NAME[s.id] ?? `${s.host}-svc`, sloTarget: 99.9, burnRate: w.serviceBurn, errorBudgetPct: w.serviceBudget },
		cpu: { current: s.cpu, unit: "vCPU", series: series(s.cpu, Math.max(0.06, s.cpu * 0.4), i) },
		mem: { current: s.mem, unit: "MB", series: series(s.mem, Math.max(8, s.mem * 0.18), i + 2) },
		disk: { current: s.disk, unit: "GB", series: series(s.disk, Math.max(0.1, s.disk * 0.08), i + 4) },
		latencyMs: s.latencyMs,
		heartbeat: { intervalMs: s.status === "idle" ? 6000 : s.status === "critical" ? 900 : s.status === "degraded" ? 1800 : 2600, ticks: hb(i) },
		tools: s.tools,
		mcpServers: s.mcp,
		cron: s.cron,
		dependsOn: s.dependsOn,
		terminalLines: s.tail,
		uptime: s.uptime,
		autonomyTier: auto.tier,
		readiness: auto.readiness,
		provingEnv: auto.env,
		verifiedRuns: auto.verifiedRuns,
		successRate: auto.successRate,
		overrideRate: auto.overrideRate,
		evalPassRate: w.evalPassRate,
		humanAgreementRate: w.humanAgreementRate,
		reviewSamplingRate: w.reviewSamplingRate,
		incidents: auto.incidents,
		soakMs: Math.round(auto.soakH * MS_PER_HOUR),
		critStreak: 0,
		cooldown: 0,
	};
});

// --- Command palette entities (agents, not projects) -----------------------
export const agentCommandEntities: CommandEntity[] = agents.map((a) => ({
	id: a.id,
	name: a.name,
	status: a.status,
	href: `/dashboard#${a.id}`,
	keywords: `${a.host} ${a.org} ${a.region} ${a.zone} ${a.status}`,
}));

// --- Fleet rollup for the summary bar --------------------------------------
export function fleetOverview(list: SreAgent[] = agents) {
	const count = (s: AgentStatus) => list.filter((a) => a.status === s).length;
	return {
		total: list.length,
		healthy: count("healthy"),
		degraded: count("degraded"),
		critical: count("critical"),
		idle: count("idle"),
	};
}
