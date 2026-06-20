import {
	CARD_H,
	CARD_W,
	CELL,
	STATUS_RANK,
	WORLD,
	zones,
	type AgentStatus,
	type SreAgent,
	type Tier,
} from "@/lib/sre-data";

// Center-distance below which two cards in the same zone join one sub-cluster.
// Tuned to the seed lattice: vertical neighbours (288px) link, horizontal
// neighbours (336px) do not — so each multi-card zone reads as columns a/b.
const CLUSTER_THRESHOLD = 312;

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

function overlaps(x: number, y: number, o: SreAgent): boolean {
	return x < o.pos.x + CARD_W && x + CARD_W > o.pos.x && y < o.pos.y + CARD_H && y + CARD_H > o.pos.y;
}

// "Magnetic" drop: quantize to the 48px lattice, then spiral out to the nearest
// free cell so cards never occlude. Deterministic — reads as magnetic, never
// jitters like a physics sim.
export function snapToFreeCell(
	agents: SreAgent[],
	agentId: string,
	targetX: number,
	targetY: number,
): { x: number; y: number } {
	const others = agents.filter((a) => a.id !== agentId);
	const q = (v: number) => Math.round(v / CELL) * CELL;
	const bx = clamp(q(targetX), 0, WORLD.width - CARD_W);
	const by = clamp(q(targetY), 0, WORLD.height - CARD_H);
	const free = (x: number, y: number) => !others.some((o) => overlaps(x, y, o));
	if (free(bx, by)) return { x: bx, y: by };
	for (let ring = 1; ring <= 16; ring += 1) {
		for (let dx = -ring; dx <= ring; dx += 1) {
			for (let dy = -ring; dy <= ring; dy += 1) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
				const x = clamp(bx + dx * CELL, 0, WORLD.width - CARD_W);
				const y = clamp(by + dy * CELL, 0, WORLD.height - CARD_H);
				if (free(x, y)) return { x, y };
			}
		}
	}
	return { x: bx, y: by };
}

export type AgentGroup = {
	key: string; // stable per zone + reading-order index, e.g. "core:0"
	zone: Tier;
	label: string; // sticky name or derived "CORE/a"
	members: SreAgent[];
	worst: AgentStatus;
};

const center = (a: SreAgent) => ({ x: a.pos.x + CARD_W / 2, y: a.pos.y + CARD_H / 2 });
const LETTERS = "abcdefghijklmnop";

// Single-link clustering per zone -> reading-order labels (CORE/a, CORE/b...).
// Mirrors the proximity-board reference: where you place a card derives its
// sub-group. groupNames provides sticky human overrides keyed by stable index.
export function deriveGroups(agents: SreAgent[], groupNames: Record<string, string> = {}): AgentGroup[] {
	const out: AgentGroup[] = [];
	for (const zone of zones) {
		const members = agents.filter((a) => a.zone === zone.id);
		if (members.length === 0) continue;

		// union-find on proximity
		const parent = members.map((_, i) => i);
		const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
		const union = (i: number, j: number) => {
			parent[find(i)] = find(j);
		};
		for (let i = 0; i < members.length; i += 1) {
			for (let j = i + 1; j < members.length; j += 1) {
				const ci = center(members[i]);
				const cj = center(members[j]);
				if (Math.hypot(ci.x - cj.x, ci.y - cj.y) <= CLUSTER_THRESHOLD) union(i, j);
			}
		}
		const buckets = new Map<number, SreAgent[]>();
		members.forEach((m, i) => {
			const r = find(i);
			const arr = buckets.get(r) ?? [];
			arr.push(m);
			buckets.set(r, arr);
		});

		// reading order: top-most then left-most representative
		const clusters = [...buckets.values()].sort((a, b) => {
			const ra = a.reduce((p, m) => (m.pos.y < p.pos.y || (m.pos.y === p.pos.y && m.pos.x < p.pos.x) ? m : p));
			const rb = b.reduce((p, m) => (m.pos.y < p.pos.y || (m.pos.y === p.pos.y && m.pos.x < p.pos.x) ? m : p));
			return ra.pos.y - rb.pos.y || ra.pos.x - rb.pos.x;
		});

		clusters.forEach((cluster, idx) => {
			const key = `${zone.id}:${idx}`;
			const worst = cluster.reduce(
				(w, m) => (STATUS_RANK[m.status] > STATUS_RANK[w] ? m.status : w),
				"idle" as AgentStatus,
			);
			out.push({
				key,
				zone: zone.id,
				label: groupNames[key] ?? `${zone.title}/${LETTERS[idx] ?? idx + 1}`,
				members: cluster.sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x),
				worst,
			});
		});
	}
	return out;
}
