"use client";

import { Circle, Crosshair, ShieldAlert, Square, Users, Zap } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import { blastRadius, topBlastRadii, type Blast } from "@/lib/blast";
import { AUTONOMY_FILL_PCT, TIER_LABEL } from "@/lib/promotion";
import { zones, type SreAgent, type Tier } from "@/lib/sre-data";

import { AutonomyChip } from "./AutonomyChip";
import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

const VB_W = 1488;
const VB_H = 1224;
const PAD = 96; // inner padding within a zone rect
const MUTATING_TOOL = new Set(["scale", "heal", "lock"]);
const canMutate = (a: SreAgent) => a.tools.some((t) => MUTATING_TOOL.has(t.id));

// Deterministic 2-col grid layout inside each zone — keeps the "same world" as
// the canvas (edge/core/data/batch quadrants) without depending on card geometry.
function layout(agents: SreAgent[]): Map<string, { x: number; y: number }> {
	const pos = new Map<string, { x: number; y: number }>();
	for (const z of zones) {
		const members = agents.filter((a) => a.zone === z.id);
		const cols = members.length > 1 ? 2 : 1;
		const rows = Math.max(1, Math.ceil(members.length / cols));
		const cellW = (z.rect.w - 2 * PAD) / cols;
		const cellH = (z.rect.h - 2 * PAD) / rows;
		members.forEach((a, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			pos.set(a.id, {
				x: z.rect.x + PAD + cellW * (col + 0.5),
				y: z.rect.y + PAD + cellH * (row + 0.5),
			});
		});
	}
	return pos;
}

// The Authority & Blast-Radius map. One bad call from an agent cascades through
// everything downstream of it; this draws that reach over the spatial world and
// composes the four levers that decide it: dependsOn (edges), tools (node shape),
// autonomy (inner ink), env (production ring). Health stays the only color.
export function BlastLens({ className }: { className?: string }) {
	const { state, select, focusZone } = useLens();
	const agents = state.agents;
	const pos = useMemo(() => layout(agents), [agents]);
	const ranking = useMemo(() => topBlastRadii(agents), [agents]);

	const originId = state.selectedId && pos.has(state.selectedId) ? state.selectedId : ranking[0]?.id ?? agents[0]?.id ?? null;
	const blast = useMemo(() => (originId ? blastRadius(agents, originId) : null), [agents, originId]);
	const origin = agents.find((a) => a.id === originId) ?? null;
	const blastSet = useMemo(() => new Set(blast ? [blast.originId, ...blast.affectedIds] : []), [blast]);

	const pick = (id: string) => {
		select(id);
		const z = agents.find((a) => a.id === id)?.zone;
		if (z) focusZone(z);
	};

	return (
		<div className={cn("flex h-full min-h-0", className)}>
			{/* map */}
			<div className="relative min-w-0 flex-1">
				<svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Authority and blast-radius map">
					{/* zone rects + criticality-tier labels */}
					{zones.map((z) => (
						<g key={z.id}>
							<rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} fill="none" stroke="var(--ret-border)" strokeWidth={1.5} />
							<text x={z.rect.x + 16} y={z.rect.y + 34} fill="var(--ret-text-muted)" fontSize={26} fontFamily="var(--font-mono, monospace)" letterSpacing={2}>
								{z.title} · T{z.tier}
							</text>
						</g>
					))}

					{/* dependency edges */}
					{agents.flatMap((a) =>
						a.dependsOn.map((depId) => {
							const from = pos.get(a.id);
							const to = pos.get(depId);
							if (!from || !to) return null;
							const inBlast = blastSet.has(a.id) && blastSet.has(depId);
							return (
								<line
									key={`${a.id}-${depId}`}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									stroke={inBlast ? "var(--ret-accent)" : "var(--ret-border)"}
									strokeWidth={inBlast ? 3 : 1.25}
									opacity={inBlast ? 0.9 : originId ? 0.18 : 0.5}
								/>
							);
						}),
					)}

					{/* nodes */}
					{agents.map((a) => {
						const p = pos.get(a.id);
						if (!p) return null;
						return (
							<BlastNode
								key={a.id}
								a={a}
								x={p.x}
								y={p.y}
								state={a.id === originId ? "origin" : blastSet.has(a.id) ? "affected" : originId ? "dim" : "rest"}
								onPick={() => pick(a.id)}
							/>
						);
					})}
				</svg>

				<Legend />
			</div>

			{/* summary */}
			<aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-[var(--ret-border)] bg-[var(--ret-bg)]">
				<div className="border-b border-[var(--ret-border)] px-3 py-2">
					<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Widest blast radius</span>
					<div className="mt-1.5 flex flex-wrap gap-1">
						{ranking.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => pick(r.id)}
								className={cn(
									"flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
									r.id === originId
										? "border-[var(--ret-accent)] text-[var(--ret-text)]"
										: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
								)}
							>
								{r.name}
								<span className="tabular-nums text-[var(--ret-text-muted)]">{r.agentCount}</span>
							</button>
						))}
					</div>
				</div>

				{origin && blast ? <BlastDetail origin={origin} blast={blast} onPick={pick} /> : null}
			</aside>
		</div>
	);
}

function BlastNode({
	a,
	x,
	y,
	state,
	onPick,
}: {
	a: SreAgent;
	x: number;
	y: number;
	state: "origin" | "affected" | "dim" | "rest";
	onPick: () => void;
}) {
	const fill = STATUS_COLOR_VAR[a.status];
	const r = 26;
	const inkR = 5 + 11 * (AUTONOMY_FILL_PCT[a.autonomyTier] / 100); // autonomy = inner ink size
	const mutate = canMutate(a);
	const opacity = state === "dim" ? 0.32 : 1;
	const ring = state === "origin" ? "var(--ret-accent)" : state === "affected" ? "var(--ret-accent)" : "var(--ret-border-hover)";
	const ringW = state === "origin" ? 5 : state === "affected" ? 3 : 1.5;

	return (
		<g opacity={opacity} onClick={onPick} style={{ cursor: "pointer" }}>
			{/* production = real traffic = a dashed containment ring */}
			{a.provingEnv === "production" ? (
				<circle cx={x} cy={y} r={r + 8} fill="none" stroke="var(--ret-text-dim)" strokeWidth={1.5} strokeDasharray="4 5" />
			) : null}
			{/* shape encodes authority: square = can mutate the world, circle = read-only */}
			{mutate ? (
				<rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={fill} stroke={ring} strokeWidth={ringW} />
			) : (
				<circle cx={x} cy={y} r={r} fill={fill} stroke={ring} strokeWidth={ringW} />
			)}
			{/* inner ink dot = autonomy level */}
			<circle cx={x} cy={y} r={inkR} fill="var(--ret-bg)" opacity={0.55} />
			<text x={x} y={y + r + 28} textAnchor="middle" fill="var(--ret-text-dim)" fontSize={26} fontFamily="var(--font-mono, monospace)">
				{a.name}
			</text>
		</g>
	);
}

function BlastDetail({ origin, blast: b, onPick }: { origin: SreAgent; blast: Blast; onPick: (id: string) => void }) {
	const underWatched = b.agentCount >= 4 && (origin.autonomyTier === "harnessed" || origin.autonomyTier === "supervised");
	return (
		<div className="px-3 py-2.5">
			<div className="flex items-center gap-2">
				<Crosshair className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
				<span className="text-[15px] font-semibold">{origin.name}</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{origin.provingEnv}</span>
			</div>
			<div className="mt-1.5">
				<AutonomyChip tier={origin.autonomyTier} readiness={origin.readiness} />
			</div>

			<div className="mt-3 flex items-end gap-2">
				<span className="font-mono text-[28px] leading-none tabular-nums">{b.agentCount}</span>
				<span className="pb-1 font-mono text-[11px] text-[var(--ret-text-muted)]">agents downstream · {b.depth} hop{b.depth === 1 ? "" : "s"}</span>
			</div>
			<div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
				<span>{b.services.length} services</span>
				<span>{b.zones.length} zones</span>
				<span>{b.inProduction} on prod traffic</span>
				{b.customerImpact ? <span style={{ color: STATUS_COLOR_VAR.critical }}>customer-impacting</span> : null}
			</div>

			<div className="mt-3 border-t border-[var(--ret-border)] pt-2">
				<div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
					<Zap className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> authority
				</div>
				<p className="mt-0.5 font-mono text-[11px] text-[var(--ret-text-dim)]">
					{b.authority.length ? b.authority.join(" · ") : "positional only — no mutating tools"}
				</p>
			</div>

			<div className="mt-2">
				<div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
					<ShieldAlert className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> contained by
				</div>
				<p className="mt-0.5 font-mono text-[11px] text-[var(--ret-text-dim)]">{b.containment}</p>
			</div>

			{underWatched ? (
				<p className="mt-2 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5 font-mono text-[10px] leading-relaxed text-[var(--ret-text-dim)]">
					Blast radius ({b.agentCount}) exceeds its oversight ({TIER_LABEL[origin.autonomyTier]}). Widen review before promoting.
				</p>
			) : null}

			{b.affectedIds.length ? (
				<div className="mt-3 border-t border-[var(--ret-border)] pt-2">
					<div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
						<Users className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> downstream
					</div>
					<div className="mt-1 flex flex-wrap gap-1">
						{b.affectedIds.map((id) => (
							<DownstreamChip key={id} id={id} onPick={onPick} />
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

function DownstreamChip({ id, onPick }: { id: string; onPick: (id: string) => void }) {
	const { state } = useLens();
	const a = state.agents.find((x) => x.id === id);
	if (!a) return null;
	return (
		<button
			type="button"
			onClick={() => onPick(id)}
			className="flex items-center gap-1 border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]"
			title={`${a.status} · ${a.service.name}`}
		>
			<span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR_VAR[a.status] }} aria-hidden="true" />
			{a.name}
		</button>
	);
}

function Legend() {
	return (
		<div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 border border-[var(--ret-border)] bg-[var(--ret-bg)]/85 px-2 py-1.5 font-mono text-[10px] text-[var(--ret-text-muted)] backdrop-blur-sm">
			<span className="flex items-center gap-1.5">
				<Square className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" /> can mutate
				<Circle className="ml-2 h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" /> read-only
			</span>
			<span>inner ink = autonomy · dashed ring = production</span>
			<span>fill = health · accent = blast path</span>
		</div>
	);
}
