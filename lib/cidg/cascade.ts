// CIDG cascade kernel — a faithful TypeScript PORT of the Tier-A ground-truth
// simulator in rl-env/sim/engine.py.
//
// ONE transition kernel `propagate()` over a typed dependency graph makes cascades
// EMERGENT: per-node metrics are FUNCTIONS of (a hidden fault + the topology), never
// set directly. The loud alert lands on whatever node the breach surfaces on (the
// downstream victim), not on the cause. This module is pure & deterministic so it can
// be scrubbed by tick from the UI and unit-tested by shape.
//
// Ported from: rl-env/sim/engine.py (World / propagate / apply_action / is_resolved)
//              rl-env/sim/spec.py   (Node / Edge / RootCause / SLO data model)
// Scenarios encoded from: rl-env/scenarios/cidg/{01,02,30}*.yaml
//
// NOTE ON FIDELITY: this port reproduces the engine's CORE physics — the per-tick
// survival/latency recomputation in dependency order, the required+discovery error
// edges, and root-cause-aware resolution (apply_action / is_resolved). The Python
// engine.py as committed does NOT yet integrate rate_law / persistence / pool /
// queue / flap into propagate() (those live in the spec as authored intent). We mirror
// engine.py exactly; rate_law-driven counters are shown in the UI only as labeled
// "authored intent", never folded into the measured metrics.

// ---------------------------------------------------------------------------
// Data model (mirrors sim/spec.py — only the fields propagate() actually reads)
// ---------------------------------------------------------------------------

export type NodeKind =
	| "service"
	| "datastore"
	| "cache"
	| "queue"
	| "pool"
	| "control_plane"
	| "monitoring"
	| "node"
	| "lb"
	| "external";

export type EdgeType =
	| "required"
	| "optional"
	| "pool"
	| "queue"
	| "discovery"
	| "observes";

export type RootCauseKind =
	| "cpu_starve"
	| "mem_leak"
	| "pool_leak"
	| "thread_exhaust"
	| "fd_exhaust"
	| "churn_spike"
	| "config_bloat"
	| "bad_content"
	| "bad_revision"
	| "cert_expire"
	| "cache_flush"
	| "disk_fill"
	| "node_notready"
	| "net_delay"
	| "dns_race"
	| "dep_revoked"
	| "defense_amplify"
	| "host_agent_crash";

export type SloDirection = "higher_bad" | "lower_bad";
export type MetricKey = "error_rate_pct" | "p99_latency_ms";

export interface CascadeNode {
	name: string;
	kind: NodeKind;
	// short human label for the loud-symptom narrative ("product victim", "root", ...)
	role: string;
}

export interface CascadeEdge {
	src: string;
	dst: string;
	type: EdgeType;
	weight: number;
	latency_add_ms: number;
	retry: number;
}

export interface RootCause {
	location: string; // node name, or "A->B" for an edge (we read the src node)
	kind: RootCauseKind;
	severity: number; // own_error injected on the fault node
	hidden: boolean;
	persistent: boolean;
}

export interface SLO {
	metric: MetricKey;
	node: string | null; // null = primary victim (first SLO node)
	direction: SloDirection;
	threshold: number;
}

export interface ScenarioSpec {
	id: string;
	title: string;
	source: string;
	failureClass: string;
	// the loud-symptom-vs-root narrative, for the UI
	loudAlertNarrative: string;
	rootNarrative: string;
	nodes: CascadeNode[];
	edges: CascadeEdge[];
	rootCause: RootCause;
	slo: SLO[];
	// the canonical fix tool that actually clears the root (UI affordance)
	fixTool: string;
	fixTarget: string;
	// authored INTENT only — NOT folded into measured metrics (labeled as such)
	resolvable: boolean; // false for the singleton (no safe in-band fix)
}

// ---------------------------------------------------------------------------
// Engine physics (verbatim port of engine.py constants)
// ---------------------------------------------------------------------------

// Edge types through which a dependency's degradation reaches its caller.
export const DEP_TYPES: ReadonlySet<EdgeType> = new Set([
	"required",
	"discovery",
	"pool",
	"queue",
]);

// required + discovery both propagate error/latency to the dependent.
const ERROR_EDGE_TYPES: ReadonlySet<EdgeType> = new Set(["required", "discovery"]);

// Causal remediation: which tools actually clear each root-cause kind. Port of
// engine.REMEDIATION — the "physics" of what fixes what. A right-tool/wrong-target
// (or a tempting-but-wrong tool) genuinely fails to resolve.
export const REMEDIATION: Record<string, ReadonlySet<string>> = {
	cpu_starve: new Set(["scale_deployment", "increase_memory_limit"]),
	mem_leak: new Set(["increase_memory_limit", "restart_pod", "restart_service"]),
	pool_leak: new Set(["restart_service", "restart_pod"]),
	fd_exhaust: new Set(["restart_service", "restart_pod"]),
	thread_exhaust: new Set(["rollback_deployment", "restart_service"]),
	churn_spike: new Set(["modify_network_policy", "restart_service"]),
	config_bloat: new Set(["modify_network_policy", "restart_service"]),
	bad_content: new Set(["rollback_deployment"]),
	bad_revision: new Set(["rollback_deployment"]),
	cert_expire: new Set(["renew_certificate"]),
	cache_flush: new Set(["clear_cache"]),
	disk_fill: new Set(["rotate_logs", "restart_pod"]),
	node_notready: new Set(["cordon_node", "drain_node"]),
	net_delay: new Set(["modify_network_policy"]),
	dns_race: new Set(["modify_network_policy", "restart_service"]),
	dep_revoked: new Set([
		"modify_network_policy",
		"restart_service",
		"failover_service",
	]),
	defense_amplify: new Set(["modify_network_policy", "scale_deployment"]),
	host_agent_crash: new Set(["rollback_deployment"]),
};

export interface Action {
	tool: string;
	target: string;
}

// ---------------------------------------------------------------------------
// Dependency order (port of engine._dep_order)
// ---------------------------------------------------------------------------

// Return node names so every dependency precedes the node that depends on it
// (deps first). `src` depends on `dst` for dependency-bearing edge types. The temp
// guard breaks cycles, matching the Python DFS exactly.
function depOrder(spec: ScenarioSpec): string[] {
	const deps = new Map<string, string[]>();
	for (const n of spec.nodes) deps.set(n.name, []);
	for (const e of spec.edges) {
		if (DEP_TYPES.has(e.type) && deps.has(e.src) && deps.has(e.dst)) {
			deps.get(e.src)!.push(e.dst);
		}
	}
	const order: string[] = [];
	const seen = new Set<string>();
	const temp = new Set<string>();

	const visit = (n: string): void => {
		if (seen.has(n) || temp.has(n)) return;
		temp.add(n);
		for (const d of deps.get(n) ?? []) visit(d);
		temp.delete(n);
		seen.add(n);
		order.push(n);
	};

	for (const n of deps.keys()) visit(n);
	return order;
}

// ---------------------------------------------------------------------------
// World — a live, deterministic episode (port of engine.World)
// ---------------------------------------------------------------------------

export interface NodeMetric {
	error_rate_pct: number;
	p99_latency_ms: number;
}

export class World {
	readonly spec: ScenarioSpec;
	tick = 0;
	nodes: Map<string, NodeMetric> = new Map();
	ownError: Map<string, number> = new Map();
	private readonly faultNode: string;
	private readonly order: string[];
	private readonly errorEdges: CascadeEdge[];

	constructor(spec: ScenarioSpec, inject = true) {
		this.spec = spec;
		for (const n of spec.nodes) {
			this.nodes.set(n.name, { error_rate_pct: 0.0, p99_latency_ms: 50.0 });
			this.ownError.set(n.name, 0.0);
		}
		const rc = spec.rootCause;
		const loc = rc.location.includes("->")
			? rc.location.split("->")[0].trim()
			: rc.location;
		this.faultNode = loc;
		if (inject) this.ownError.set(loc, rc.severity);
		this.order = depOrder(spec);
		this.errorEdges = spec.edges.filter((e) => ERROR_EDGE_TYPES.has(e.type));
		this.propagate();
	}

	static fromSpec(spec: ScenarioSpec, inject = true): World {
		return new World(spec, inject);
	}

	metric(node: string, key: MetricKey): number {
		return this.nodes.get(node)![key];
	}

	run(ticks = 1): World {
		for (let i = 0; i < ticks; i++) {
			this.tick += 1;
			this.propagate();
		}
		return this;
	}

	// Recompute every node's metrics from its own fault + its required deps, in
	// dependency order. error multiplies through required chains; latency adds.
	// Verbatim port of engine.propagate().
	propagate(): void {
		for (const name of this.order) {
			let survival = 1.0 - (this.ownError.get(name) ?? 0);
			let latency = 50.0;
			for (const e of this.errorEdges) {
				if (e.src !== name) continue;
				const depErr = this.nodes.get(e.dst)!.error_rate_pct / 100.0;
				survival *= 1.0 - depErr * e.weight;
				latency += this.nodes.get(e.dst)!.p99_latency_ms * e.weight + e.latency_add_ms;
			}
			const m = this.nodes.get(name)!;
			m.error_rate_pct = 100.0 * (1.0 - survival);
			m.p99_latency_ms = latency;
		}
	}

	get rootCleared(): boolean {
		return (this.ownError.get(this.faultNode) ?? 0) === 0.0;
	}

	get faultNodeName(): string {
		return this.faultNode;
	}
}

// Apply a remediation. The root cause is cleared ONLY by a tool that causally fixes
// its kind AND targets the root node — right-tool/wrong-target does nothing.
// Port of engine.apply_action().
export function applyAction(world: World, action: Action): void {
	const kind = world.spec.rootCause.kind;
	const rem = REMEDIATION[kind] ?? new Set<string>();
	if (rem.has(action.tool) && action.target === world.faultNodeName) {
		world.ownError.set(world.faultNodeName, 0.0);
	}
	world.propagate();
}

// First SLO that names a node is the primary victim. Port of engine._slo_ok().
function sloOk(world: World): boolean {
	const primary = world.spec.slo.find((s) => s.node)?.node ?? null;
	for (const s of world.spec.slo) {
		const node = s.node ?? primary;
		if (!node) continue;
		const val = world.metric(node, s.metric);
		if (s.direction === "higher_bad" && val >= s.threshold) return false;
		if (s.direction === "lower_bad" && val <= s.threshold) return false;
	}
	return true;
}

// Root-cause-aware: SLOs back under threshold AND the hidden root is cleared.
// Metric-masking (green metrics, root still active) does NOT count. Port of
// engine.is_resolved().
export function isResolved(world: World): boolean {
	return world.rootCleared && sloOk(world);
}

// ---------------------------------------------------------------------------
// Convenience: which SLO nodes are currently breaching, and who is loudest.
// The "loudest alert" is the node with the highest error_rate among the SLO
// victims — which is emergently a DOWNSTREAM victim, not the root cause.
// ---------------------------------------------------------------------------

export function sloNodes(spec: ScenarioSpec): string[] {
	const primary = spec.slo.find((s) => s.node)?.node ?? null;
	const out: string[] = [];
	for (const s of spec.slo) {
		const n = s.node ?? primary;
		if (n && !out.includes(n)) out.push(n);
	}
	return out;
}

export interface LoudestAlert {
	node: string;
	errorPct: number;
	isRoot: boolean;
}

export function loudestAlert(world: World): LoudestAlert | null {
	const nodes = sloNodes(world.spec);
	let best: LoudestAlert | null = null;
	for (const n of nodes) {
		const e = world.metric(n, "error_rate_pct");
		if (best === null || e > best.errorPct) {
			best = { node: n, errorPct: e, isRoot: n === world.faultNodeName };
		}
	}
	return best;
}

// Deterministic per-tick snapshot of the whole graph, for the UI scrubber. Builds a
// fresh World and runs it `tick` ticks (pure: no shared mutable state leaks out).
export interface TickSnapshot {
	tick: number;
	metrics: Record<string, NodeMetric>;
	loudest: LoudestAlert | null;
	rootCleared: boolean;
	resolved: boolean;
}

export function snapshotAt(
	spec: ScenarioSpec,
	tick: number,
	inject: boolean,
): TickSnapshot {
	const w = World.fromSpec(spec, inject);
	if (tick > 0) w.run(tick);
	const metrics: Record<string, NodeMetric> = {};
	for (const [name, m] of w.nodes) {
		metrics[name] = { error_rate_pct: m.error_rate_pct, p99_latency_ms: m.p99_latency_ms };
	}
	return {
		tick,
		metrics,
		loudest: loudestAlert(w),
		rootCleared: w.rootCleared,
		resolved: isResolved(w),
	};
}

// Precompute the full tick series 0..maxTick once (memo-friendly for the UI).
export function tickSeries(
	spec: ScenarioSpec,
	maxTick: number,
	inject: boolean,
): TickSnapshot[] {
	const w = World.fromSpec(spec, inject);
	const series: TickSnapshot[] = [];
	for (let t = 0; t <= maxTick; t++) {
		if (t > 0) w.run(1);
		const metrics: Record<string, NodeMetric> = {};
		for (const [name, m] of w.nodes) {
			metrics[name] = {
				error_rate_pct: m.error_rate_pct,
				p99_latency_ms: m.p99_latency_ms,
			};
		}
		series.push({
			tick: t,
			metrics,
			loudest: loudestAlert(w),
			rootCleared: w.rootCleared,
			resolved: isResolved(w),
		});
	}
	return series;
}

// ---------------------------------------------------------------------------
// Encoded scenario topologies (from rl-env/scenarios/cidg/*.yaml). Layout
// coordinates are AUTHORED for the visualizer (not from the spec) — they do not
// affect the kernel, which is topology-only.
// ---------------------------------------------------------------------------

export interface LayoutPos {
	x: number;
	y: number;
}

export interface CascadeScenario extends ScenarioSpec {
	// normalized [0,1] layout positions for the node-link graph
	layout: Record<string, LayoutPos>;
	// suggested max tick for the scrubber
	maxTick: number;
}

// --- 01: GCP Service Control quota-policy crash loop ---------------------------
const GCP_SERVICE_CONTROL: CascadeScenario = {
	id: "gcp-service-control",
	title: "GCP Service Control quota-policy crash loop",
	source: "Google Cloud incident ow5i3PPK96RduMcb1SsW (Jun 12 2025)",
	failureClass: "config-propagation + control-plane-crashloop + herd-recovery",
	loudAlertNarrative:
		"The loudest 503/error alerts fire on product VICTIMS (workspace, compute-api) routed through the gateway — not on service-control, the control plane that actually broke.",
	rootNarrative:
		"Blank fields in a globally-replicated quota policy hit a missing null-check in Service Control → crash loop. config_bloat on service-control.",
	nodes: [
		{ name: "service-control", kind: "control_plane", role: "root · control plane" },
		{ name: "spanner", kind: "datastore", role: "herd choke point" },
		{ name: "api-gateway", kind: "lb", role: "auth/quota gateway" },
		{ name: "workspace", kind: "service", role: "product victim" },
		{ name: "compute-api", kind: "service", role: "product victim" },
		{ name: "bigquery-api", kind: "service", role: "product victim" },
		{ name: "cloud-service-health", kind: "monitoring", role: "monitoring (degraded)" },
	],
	edges: [
		{ src: "api-gateway", dst: "service-control", type: "discovery", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "service-control", dst: "spanner", type: "pool", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "workspace", dst: "api-gateway", type: "required", weight: 1.0, latency_add_ms: 5, retry: 0.4 },
		{ src: "compute-api", dst: "api-gateway", type: "required", weight: 1.0, latency_add_ms: 5, retry: 0.4 },
		{ src: "bigquery-api", dst: "api-gateway", type: "required", weight: 1.0, latency_add_ms: 5, retry: 0.4 },
		{ src: "cloud-service-health", dst: "service-control", type: "observes", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "cloud-service-health", dst: "spanner", type: "observes", weight: 1.0, latency_add_ms: 0, retry: 0 },
	],
	rootCause: {
		location: "service-control",
		kind: "config_bloat",
		severity: 0.9,
		hidden: true,
		persistent: true,
	},
	slo: [
		{ metric: "error_rate_pct", node: "api-gateway", direction: "higher_bad", threshold: 5 },
		{ metric: "error_rate_pct", node: "workspace", direction: "higher_bad", threshold: 5 },
		{ metric: "error_rate_pct", node: "compute-api", direction: "higher_bad", threshold: 5 },
	],
	fixTool: "modify_network_policy",
	fixTarget: "service-control",
	resolvable: true,
	maxTick: 12,
	layout: {
		"spanner": { x: 0.12, y: 0.5 },
		"service-control": { x: 0.34, y: 0.5 },
		"cloud-service-health": { x: 0.24, y: 0.12 },
		"api-gateway": { x: 0.58, y: 0.5 },
		"workspace": { x: 0.86, y: 0.2 },
		"compute-api": { x: 0.88, y: 0.5 },
		"bigquery-api": { x: 0.86, y: 0.8 },
	},
};

// --- 02: CrowdStrike Falcon Channel File 291 global BSOD -----------------------
const CROWDSTRIKE_CF291: CascadeScenario = {
	id: "crowdstrike-cf291",
	title: "CrowdStrike Falcon Channel File 291 global BSOD",
	source: "CrowdStrike Channel File 291 Root Cause Analysis (Jul 19 2024)",
	failureClass: "bad-content-propagation + node-crashloop + reboot-insufficient",
	loudAlertNarrative:
		"The loudest 5xx/down alerts fire on banking, airline and hospital VICTIM services (plus 'possible intrusion' noise) — not on the security-agent DaemonSet that shipped the bad content file.",
	rootNarrative:
		"A channel file described 21 fields while the sensor read 20 → kernel out-of-bounds read → node BSOD/boot-loop. bad_content on security-agent (config data, NOT a driver).",
	nodes: [
		{ name: "security-agent", kind: "control_plane", role: "root · DaemonSet" },
		{ name: "node-a", kind: "node", role: "cluster node" },
		{ name: "node-b", kind: "node", role: "cluster node" },
		{ name: "node-c", kind: "node", role: "cluster node" },
		{ name: "session-store", kind: "datastore", role: "fan-in choke point" },
		{ name: "banking-api", kind: "service", role: "product victim (banks)" },
		{ name: "airline-checkin", kind: "service", role: "product victim (airlines)" },
		{ name: "hospital-ehr", kind: "service", role: "product victim (hospitals)" },
		{ name: "cluster-monitor", kind: "monitoring", role: "monitoring (degraded)" },
	],
	edges: [
		{ src: "node-a", dst: "security-agent", type: "discovery", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "node-b", dst: "security-agent", type: "discovery", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "node-c", dst: "security-agent", type: "discovery", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "banking-api", dst: "node-a", type: "required", weight: 1.0, latency_add_ms: 8, retry: 0.5 },
		{ src: "airline-checkin", dst: "node-b", type: "required", weight: 1.0, latency_add_ms: 8, retry: 0.5 },
		{ src: "hospital-ehr", dst: "node-c", type: "required", weight: 1.0, latency_add_ms: 8, retry: 0.5 },
		{ src: "banking-api", dst: "session-store", type: "pool", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "airline-checkin", dst: "session-store", type: "pool", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "hospital-ehr", dst: "session-store", type: "pool", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "cluster-monitor", dst: "node-a", type: "observes", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "cluster-monitor", dst: "node-b", type: "observes", weight: 1.0, latency_add_ms: 0, retry: 0 },
		{ src: "cluster-monitor", dst: "node-c", type: "observes", weight: 1.0, latency_add_ms: 0, retry: 0 },
	],
	rootCause: {
		location: "security-agent",
		kind: "bad_content",
		severity: 0.95,
		hidden: true,
		persistent: true,
	},
	slo: [
		{ metric: "error_rate_pct", node: "banking-api", direction: "higher_bad", threshold: 5 },
		{ metric: "error_rate_pct", node: "airline-checkin", direction: "higher_bad", threshold: 5 },
		{ metric: "error_rate_pct", node: "hospital-ehr", direction: "higher_bad", threshold: 5 },
	],
	fixTool: "rollback_deployment",
	fixTarget: "security-agent",
	resolvable: true,
	maxTick: 12,
	layout: {
		"security-agent": { x: 0.12, y: 0.5 },
		"node-a": { x: 0.4, y: 0.18 },
		"node-b": { x: 0.4, y: 0.5 },
		"node-c": { x: 0.4, y: 0.82 },
		"banking-api": { x: 0.72, y: 0.18 },
		"airline-checkin": { x: 0.72, y: 0.5 },
		"hospital-ehr": { x: 0.72, y: 0.82 },
		"session-store": { x: 0.92, y: 0.5 },
		"cluster-monitor": { x: 0.26, y: 0.05 },
	},
};

// --- 30: Single-node pool, only worker NotReady (UNSOLVABLE / escalate) --------
const SINGLETON_NODE_NOTREADY: CascadeScenario = {
	id: "singleton-node-notready",
	title: "Single-node pool: only worker NotReady (escalate)",
	source: "Synthetic held-out scenario for the escalate path",
	failureClass: "node-notready-no-headroom",
	loudAlertNarrative:
		"edge-api breaches because its only node is NotReady. The standard fix (drain_node) IS the right tool for node_notready — but it is the last Ready node, so a safe harness blocks it.",
	rootNarrative:
		"node_notready on worker-node-1, the ONLY node. The diagnosis is easy (node named directly) but there is no safe in-band fix: the agent must ESCALATE for added capacity.",
	nodes: [
		{ name: "edge-api", kind: "service", role: "victim service" },
		{ name: "worker-node-1", kind: "node", role: "root · only node" },
	],
	edges: [
		{ src: "edge-api", dst: "worker-node-1", type: "required", weight: 1.0, latency_add_ms: 0, retry: 0 },
	],
	rootCause: {
		location: "worker-node-1",
		kind: "node_notready",
		severity: 0.85,
		hidden: false,
		persistent: false,
	},
	slo: [
		{ metric: "error_rate_pct", node: "edge-api", direction: "higher_bad", threshold: 5 },
	],
	// drain_node IS the causal remediation, but it is unsafe here (last Ready node).
	fixTool: "drain_node",
	fixTarget: "worker-node-1",
	resolvable: false, // by design: no safe in-band fix exists -> escalate
	maxTick: 10,
	layout: {
		"edge-api": { x: 0.32, y: 0.5 },
		"worker-node-1": { x: 0.72, y: 0.5 },
	},
};

export const CASCADE_SCENARIOS: CascadeScenario[] = [
	GCP_SERVICE_CONTROL,
	CROWDSTRIKE_CF291,
	SINGLETON_NODE_NOTREADY,
];

export function scenarioById(id: string): CascadeScenario | undefined {
	return CASCADE_SCENARIOS.find((s) => s.id === id);
}
