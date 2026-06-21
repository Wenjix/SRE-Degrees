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

// CIDG capstone: the agent's demonstrated incident-response competence on the
// CIDG benchmark (the merged RL environment). The "receipts" behind a promotion —
// can it diagnose a cascading outage where the loud alert points at the victim and
// the naive fix worsens it? This is the 9th promotion gate (see lib/promotion.ts).
export type Capstone = {
	rexScore: number; // 0-1 REx score on the held-out capstone incident set
	baseline: number; // 0-1 zero-shot baseline (the lift story)
	solved: number; // solvable incidents cleanly solved
	solvable: number; // total solvable incidents in the set
	escalated: boolean; // correctly escalated the one unsolvable incident (vs flailing)
	trapsTripped: number; // traps tripped — any > 0 hard-blocks promotion
	heldOut: boolean; // evaluated on held-out incidents (no contamination)
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
	critsInWindow: number; // criticals in the current soak window (NOT a declared incident)
	soakMs: number; // accumulated sim-time in the current tier
	critStreak: number; // consecutive critical ticks (sim-managed)
	cooldown: number; // ticks until eligible for auto-demote again
	capstone: Capstone; // CIDG incident-response competence (the 9th promotion gate)
};

export const MS_PER_HOUR = 3_600_000;
const MIN = 60_000;

// --- On-call cockpit: declared incidents + the human approval queue ----------
export type Severity = 1 | 2 | 3 | 4; // SEV1 = worst
export type IncidentTrend = "worsening" | "stable" | "recovering";

export type Incident = {
	id: string; // INC-204
	severity: Severity;
	title: string;
	service: string; // affected service
	zones: Tier[];
	customerImpact: boolean;
	agentIds: string[]; // implicated / responding agents
	trigger: string; // the signal that fired
	burnTrend: number[]; // owned-service burn since onset (sparkline)
	lastAction: string;
	trend: IncidentTrend;
	commander: string | null; // human incident commander; null = unassigned
	ageMs: number; // accumulated sim duration since onset
	acknowledged: boolean; // operator has acknowledged the incident
	resolved: boolean; // operator has resolved the incident (fire out)
};

export type ActionRisk = "read" | "mutate";

export type PendingAction = {
	id: string; // ACT-91
	agentId: string;
	action: string; // "scale edge-router x2"
	risk: ActionRisk; // read-only vs mutating/irreversible
	blastServices: number;
	blastInstances: number;
	blastScope: string; // "eu-west-1 · prod"
	reasoning: string; // the agent's stated justification
	confidence: number; // 0-1
	ageMs: number; // time waiting
	slaMs: number; // decision deadline
};

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

// CIDG capstone seeds. Narrative beats are pinned; the rest derive from decision
// quality. Heroes (Pan, Hera) clear their tier's bar so the live promotion holds;
// Zeus tripped a trap and sits under the 0.86 ceiling; Atlas fails the exam.
const CAPSTONE_OVERRIDE: Record<string, Capstone> = {
	"sre-4c2d": { rexScore: 0.86, baseline: 0.81, solved: 4, solvable: 4, escalated: true, trapsTripped: 0, heldOut: true }, // Hera — clears the 0.86 ceiling
	"sre-3a07": { rexScore: 0.84, baseline: 0.69, solved: 4, solvable: 4, escalated: true, trapsTripped: 0, heldOut: true }, // Pan — clears the guarded 0.80 bar
	"sre-8a13": { rexScore: 0.79, baseline: 0.7, solved: 3, solvable: 4, escalated: true, trapsTripped: 1, heldOut: true }, // Zeus — sub-ceiling + tripped a trap
	"sre-7f2a": { rexScore: 0.41, baseline: 0.38, solved: 1, solvable: 4, escalated: false, trapsTripped: 2, heldOut: true }, // Atlas — fails the exam
	"sre-2b90": { rexScore: 0.9, baseline: 0.82, solved: 4, solvable: 4, escalated: true, trapsTripped: 0, heldOut: true }, // Hermes — already autonomous, strong receipts
};

function capstoneFor(s: Seed, w: WorkSeed): Capstone {
	const o = CAPSTONE_OVERRIDE[s.id];
	if (o) return o;
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
	const r2 = (v: number) => Math.round(v * 100) / 100;
	// baseline tracks decision quality; REx lifts it toward (but not past) the ceiling.
	const baseline = r2(clamp(0.55 + (w.evalPassRate - 0.9) * 2.2, 0.5, 0.82));
	const rexScore = r2(clamp(baseline + 0.16, 0, 0.9));
	const solvable = 4;
	const solved = clamp(Math.round(rexScore * 5) - 1, 0, solvable);
	return { rexScore, baseline, solved, solvable, escalated: rexScore >= 0.7, trapsTripped: s.status === "critical" ? 1 : 0, heldOut: true };
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
		critsInWindow: auto.incidents,
		soakMs: Math.round(auto.soakH * MS_PER_HOUR),
		critStreak: 0,
		cooldown: 0,
		capstone: capstoneFor(s, w),
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

// --- Declared incidents (the real object, distinct from agent crit counters) --
export const incidentsSeed: Incident[] = [
	{
		id: "INC-204", severity: 1, title: "control-plane API error budget burning", service: "control-plane-api",
		zones: ["core"], customerImpact: true, agentIds: ["sre-7f2a"], trigger: "SLO burn 4.2x · probe core-2 FAIL x3",
		burnTrend: [1.1, 1.4, 1.9, 2.6, 3.4, 4.2], lastAction: "Atlas paging on-call", trend: "worsening", commander: null, ageMs: 12 * MIN, acknowledged: false, resolved: false,
	},
	{
		id: "INC-205", severity: 2, title: "payments-ledger budget exhausting", service: "payments-ledger",
		zones: ["core"], customerImpact: true, agentIds: ["sre-8a13"], trigger: "service burn 3.8x · budget 7%",
		burnTrend: [4.1, 3.9, 3.8, 3.8, 3.7, 3.8], lastAction: "Zeus armed auto-rollback", trend: "stable", commander: "@rivera", ageMs: 34 * MIN, acknowledged: false, resolved: false,
	},
	{
		id: "INC-206", severity: 3, title: "edge cache latency elevated", service: "cdn-cache",
		zones: ["edge"], customerImpact: false, agentIds: ["sre-9c1f"], trigger: "probe edge-3 SLOW 268ms",
		burnTrend: [2.8, 2.4, 2.0, 1.7, 1.4, 1.2], lastAction: "Nyx scheduled purge-cache", trend: "recovering", commander: "@okafor", ageMs: 51 * MIN, acknowledged: false, resolved: false,
	},
];

// --- The human approval queue (supervised/guarded agents proposing risky acts) -
export const pendingActionsSeed: PendingAction[] = [
	{
		id: "ACT-91", agentId: "sre-3a07", action: "scale edge-router ×2", risk: "mutate",
		blastServices: 1, blastInstances: 8, blastScope: "eu-west-1 · prod",
		reasoning: "p95 268ms > 200ms SLO; +2 replicas restores headroom within budget", confidence: 0.94, ageMs: 2 * MIN, slaMs: 5 * MIN,
	},
	{
		id: "ACT-92", agentId: "sre-7f2a", action: "rotate prod certs · control-plane", risk: "mutate",
		blastServices: 3, blastInstances: 40, blastScope: "us-east-1 · prod",
		reasoning: "certs expire in 12m; rotation unblocks probe core-2 and the SEV1", confidence: 0.88, ageMs: 1 * MIN, slaMs: 4 * MIN,
	},
	{
		id: "ACT-93", agentId: "sre-9c1f", action: "failover pop-fra-1 → pop-ams-1", risk: "mutate",
		blastServices: 1, blastInstances: 3, blastScope: "eu-west-1 · canary",
		reasoning: "fra POP error rate climbing; ams has capacity and lower latency", confidence: 0.79, ageMs: 4 * MIN, slaMs: 8 * MIN,
	},
	{
		id: "ACT-94", agentId: "sre-6c18", action: "compact-parquet on ingest", risk: "read",
		blastServices: 1, blastInstances: 1, blastScope: "us-east-1 · prod",
		reasoning: "scan latency rising; compaction is reversible and low blast radius", confidence: 0.97, ageMs: 6 * MIN, slaMs: 20 * MIN,
	},
	{
		id: "ACT-95", agentId: "sre-8a13", action: "promote read-replica · payments-ledger", risk: "mutate",
		blastServices: 2, blastInstances: 12, blastScope: "us-east-1 · prod",
		reasoning: "INC-205: ledger budget 7%; promote standby read-replica to shed write pressure and recover burn", confidence: 0.9, ageMs: 3 * MIN, slaMs: 6 * MIN,
	},
	{
		id: "ACT-96", agentId: "sre-3a07", action: "restart auth-cache owned by Ash", risk: "mutate",
		blastServices: 2, blastInstances: 6, blastScope: "us-east-1 · prod",
		reasoning: "Sylvie owns edge-router; auth-cache is the upstream dependency, but RBAC denies cross-owner restart", confidence: 0.86, ageMs: 5 * MIN, slaMs: 9 * MIN,
	},
];

export const SEVERITY_LABEL: Record<Severity, string> = { 1: "SEV1", 2: "SEV2", 3: "SEV3", 4: "SEV4" };

// SEV1/2 are health-critical, SEV3 degraded, SEV4 informational — maps to the
// health color ramp (incident severity IS a health signal).
export function severityTone(sev: Severity): AgentStatus {
	return sev <= 2 ? "critical" : sev === 3 ? "degraded" : "healthy";
}
