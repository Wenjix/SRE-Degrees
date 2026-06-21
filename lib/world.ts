// The modeled production estate that the fleet operates inside. Pure + node
// --test (type-only imports). The 14 real agents + their owned services are
// the interactive anchors; the rest is a seeded ambient sample standing in for
// a real deployment's pods/containers/vCPUs/etc.

import type { AgentStatus, SreAgent } from "./sre-data";

export type WorldNodeType =
	| "agent" | "service" | "pod" | "container" | "vcpu" | "host"
	| "storage" | "deployment" | "ingress" | "loadbalancer" | "secret"
	| "function" | "etcd" | "operation";

// modeled ambient estate (the 12 non-real types) — deterministic counts.
export const WORLD_TAXONOMY: { type: WorldNodeType; count: number }[] = [
	{ type: "container", count: 382_487 },
	{ type: "pod", count: 356_745 },
	{ type: "vcpu", count: 353_241 },
	{ type: "deployment", count: 196_723 },
	{ type: "storage", count: 88_765 },
	{ type: "ingress", count: 46_782 },
	{ type: "secret", count: 43_222 },
	{ type: "operation", count: 14_832 },
	{ type: "host", count: 12_888 },
	{ type: "loadbalancer", count: 9_420 },
	{ type: "etcd", count: 6_214 },
	{ type: "function", count: 4_020 },
];

export type WorldNode = {
	id: string;
	type: WorldNodeType;
	anchor: boolean; // real, named, clickable (agents + owned services)
	agentId?: string; // set on anchors → cross-lens select()
	status: AgentStatus; // drives color (health only)
	lat: number; // radians, -PI/2..PI/2
	lon: number; // radians, -PI..PI
};

export type TaxonomyRow = { type: WorldNodeType; count: number; real: boolean };

// deterministic PRNG + string hash (no module-scope randomness)
function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function latlon(u: number, v: number) {
	return { lat: Math.asin(2 * u - 1), lon: (2 * v - 1) * Math.PI };
}
const serviceStatus = (a: SreAgent): AgentStatus =>
	a.service.burnRate > 3 ? "critical" : a.service.burnRate > 1 ? "degraded" : "healthy";
const ambientStatus = (r: number): AgentStatus =>
	r < 0.82 ? "healthy" : r < 0.93 ? "degraded" : r < 0.965 ? "critical" : "idle";

function pickType(r: number): WorldNodeType {
	const total = WORLD_TAXONOMY.reduce((s, t) => s + t.count, 0);
	let x = r * total;
	for (const t of WORLD_TAXONOMY) if ((x -= t.count) <= 0) return t.type;
	return WORLD_TAXONOMY[0].type;
}

export function worldHeadcount(agents: SreAgent[]): number {
	const services = new Set(agents.map((a) => a.service.name)).size;
	return agents.length + services + WORLD_TAXONOMY.reduce((s, t) => s + t.count, 0);
}

export function taxonomyRows(agents: SreAgent[]): TaxonomyRow[] {
	const services = new Set(agents.map((a) => a.service.name)).size;
	const ambient = [...WORLD_TAXONOMY].sort((a, b) => b.count - a.count).map((t) => ({ ...t, real: false }));
	return [
		{ type: "agent", count: agents.length, real: true },
		{ type: "service", count: services, real: true },
		...ambient,
	];
}

export function worldNodes(agents: SreAgent[], sample = 1700): WorldNode[] {
	const nodes: WorldNode[] = [];
	for (const a of agents) {
		const r = mulberry32(hash(a.id));
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `agent:${a.id}`, type: "agent", anchor: true, agentId: a.id, status: a.status, lat, lon });
	}
	const seen = new Set<string>();
	for (const a of agents) {
		if (seen.has(a.service.name)) continue;
		seen.add(a.service.name);
		const r = mulberry32(hash(a.service.name));
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `svc:${a.service.name}`, type: "service", anchor: true, agentId: a.id, status: serviceStatus(a), lat, lon });
	}
	const r = mulberry32(0x5eed1e);
	for (let i = 0; i < sample; i++) {
		const { lat, lon } = latlon(r(), r());
		nodes.push({ id: `amb:${i}`, type: pickType(r()), anchor: false, status: ambientStatus(r()), lat, lon });
	}
	return nodes;
}
