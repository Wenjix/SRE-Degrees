"use client";

import { useEffect, useMemo, useState } from "react";

import { AlertTriangle, Crosshair, Play, Power, RotateCcw } from "lucide-react";

import { cn } from "@/lib/cn";
import {
	CASCADE_SCENARIOS,
	type CascadeEdge,
	type CascadeScenario,
	type EdgeType,
	tickSeries,
	type TickSnapshot,
} from "@/lib/cidg/cascade";
import { scoreColor } from "@/lib/cidg/shared";

const VB_W = 760;
const VB_H = 440;
const PAD_X = 60;
const PAD_Y = 48;

// error_rate_pct -> health. Health is the only color (Reticle contract): a clean node
// reads green, a fully-breached node reads red. We map error% [0,100] -> score [1,0].
function healthOfError(errorPct: number): string {
	return scoreColor(1 - errorPct / 100);
}

// hand-rolled prefers-reduced-motion read (SSR-safe; defaults to reduced so we never
// auto-animate before we know).
function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(true);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const on = () => setReduced(mq.matches);
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return reduced;
}

const EDGE_DASH: Partial<Record<EdgeType, string>> = {
	discovery: "6 4",
	observes: "1 5",
	pool: "10 4",
	queue: "2 3",
};

function Chip({
	active,
	onClick,
	children,
	title,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
	title?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			title={title}
			className={cn(
				"border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
				active
					? "border-[var(--ret-accent)] bg-[var(--ret-accent)] text-[var(--ret-bg)]"
					: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
			)}
		>
			{children}
		</button>
	);
}

// CASCADE — a live, deterministic visualizer of the propagate() dependency-cascade
// kernel (ported verbatim from rl-env/sim/engine.py). Pick a scenario, toggle the
// hidden root fault, and scrub TICKS while error%/latency light nodes along typed
// edges. The whole thesis: the LOUDEST alert fires on a downstream VICTIM, not the
// cause. Numbers are MEASURED by the ported kernel; layout is authored for the view.
export function CascadeLens() {
	const reduced = useReducedMotion();
	const [scenarioId, setScenarioId] = useState(CASCADE_SCENARIOS[0].id);
	const [inject, setInject] = useState(true);
	const [tick, setTick] = useState(4);
	const [selected, setSelected] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);

	const scenario = useMemo(
		() => CASCADE_SCENARIOS.find((s) => s.id === scenarioId) ?? CASCADE_SCENARIOS[0],
		[scenarioId],
	);

	// Precompute the full deterministic tick series once per (scenario, inject). The
	// kernel is pure; this is the source of every number on screen.
	const series = useMemo<TickSnapshot[]>(
		() => tickSeries(scenario, scenario.maxTick, inject),
		[scenario, inject],
	);
	// control series (no fault) for the side-by-side contrast in the detail panel.
	const controlSeries = useMemo<TickSnapshot[]>(
		() => tickSeries(scenario, scenario.maxTick, false),
		[scenario],
	);

	const clampedTick = Math.min(tick, scenario.maxTick);
	const snap = series[clampedTick];

	// auto-advance only when explicitly playing AND motion is allowed.
	useEffect(() => {
		if (!playing || reduced) return;
		if (clampedTick >= scenario.maxTick) {
			setPlaying(false);
			return;
		}
		const id = setTimeout(() => setTick((t) => Math.min(t + 1, scenario.maxTick)), 700);
		return () => clearTimeout(id);
	}, [playing, reduced, clampedTick, scenario.maxTick]);

	const onPickScenario = (id: string) => {
		setScenarioId(id);
		setSelected(null);
		setPlaying(false);
		setTick((t) => Math.min(t, CASCADE_SCENARIOS.find((s) => s.id === id)?.maxTick ?? t));
	};

	const loudest = snap.loudest;
	const selectedNode = selected ?? loudest?.node ?? scenario.rootCause.location;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* header + scenario picker */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
							propagate() cascade kernel · live port
						</p>
						<h1 className="ret-display text-[16px]">
							Loudest alert fires on the <span className="text-[var(--ret-text-muted)]">victim</span>, not the cause
						</h1>
					</div>
					<button
						type="button"
						onClick={() => setInject((v) => !v)}
						aria-pressed={inject}
						className={cn(
							"flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
							inject
								? "border-[var(--ret-red)] text-[var(--ret-red)]"
								: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)]",
						)}
						title="Inject / clear the hidden root fault — the emergent-cascade vs control contrast"
					>
						<Power className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
						{inject ? "fault injected" : "fault off (control)"}
					</button>
				</div>

				<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">scenario</span>
					{CASCADE_SCENARIOS.map((s) => (
						<Chip key={s.id} active={s.id === scenarioId} onClick={() => onPickScenario(s.id)} title={s.source}>
							{shortLabel(s)}
						</Chip>
					))}
				</div>
			</div>

			{/* tick scrubber */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-4 py-2.5">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setPlaying((p) => !p)}
						disabled={reduced}
						className={cn(
							"flex h-7 w-7 shrink-0 items-center justify-center border transition-colors",
							reduced
								? "cursor-not-allowed border-[var(--ret-border)] text-[var(--ret-text-muted)] opacity-50"
								: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
						)}
						title={reduced ? "auto-play disabled (reduced motion) — scrub manually" : playing ? "pause" : "play ticks"}
						aria-label={playing ? "pause" : "play ticks"}
					>
						<Play className="h-3.5 w-3.5" strokeWidth={2} fill={playing ? "currentColor" : "none"} aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => {
							setTick(0);
							setPlaying(false);
						}}
						className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--ret-border)] text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]"
						title="reset to tick 0"
						aria-label="reset to tick 0"
					>
						<RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
					</button>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<span className="shrink-0 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">tick</span>
						<input
							type="range"
							min={0}
							max={scenario.maxTick}
							step={1}
							value={clampedTick}
							onChange={(e) => {
								setTick(Number(e.target.value));
								setPlaying(false);
							}}
							className="h-1 min-w-0 flex-1 cursor-pointer appearance-none bg-[var(--ret-border)] accent-[var(--ret-accent)]"
							aria-label="Scrub simulation tick"
						/>
						<span className="w-12 shrink-0 text-right font-mono text-[13px] tabular-nums">
							{clampedTick}
							<span className="text-[var(--ret-text-muted)]">/{scenario.maxTick}</span>
						</span>
					</div>
				</div>
				{reduced ? (
					<p className="mt-1 font-mono text-[9px] text-[var(--ret-text-muted)]">
						reduced-motion: auto-play off — scrub the slider to step the kernel.
					</p>
				) : null}
			</div>

			{/* graph + detail */}
			<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
				<div className="relative min-h-0 overflow-hidden">
					<CascadeGraph scenario={scenario} snap={snap} inject={inject} selected={selectedNode} onPick={(n) => setSelected(n)} />
					<Legend />
				</div>

				<aside className="min-h-0 overflow-auto border-t border-[var(--ret-border)] bg-[var(--ret-bg-soft)] lg:border-l lg:border-t-0">
					<DetailPanel
						scenario={scenario}
						snap={snap}
						controlSnap={controlSeries[clampedTick]}
						inject={inject}
						selected={selectedNode}
						series={series}
						tick={clampedTick}
					/>
				</aside>
			</div>
		</div>
	);
}

function shortLabel(s: CascadeScenario): string {
	if (s.id === "gcp-service-control") return "gcp service-control";
	if (s.id === "crowdstrike-cf291") return "crowdstrike cf291";
	if (s.id === "singleton-node-notready") return "singleton notready";
	return s.id;
}

// ---------------------------------------------------------------------------
// The node-link graph (hand-rolled SVG; node encoding mirrors BlastLens)
// ---------------------------------------------------------------------------

function CascadeGraph({
	scenario,
	snap,
	inject,
	selected,
	onPick,
}: {
	scenario: CascadeScenario;
	snap: TickSnapshot;
	inject: boolean;
	selected: string;
	onPick: (n: string) => void;
}) {
	const pos = useMemo(() => {
		const m = new Map<string, { x: number; y: number }>();
		for (const n of scenario.nodes) {
			const p = scenario.layout[n.name] ?? { x: 0.5, y: 0.5 };
			m.set(n.name, {
				x: PAD_X + p.x * (VB_W - 2 * PAD_X),
				y: PAD_Y + p.y * (VB_H - 2 * PAD_Y),
			});
		}
		return m;
	}, [scenario]);

	const faultNode = scenario.rootCause.location;
	const loudNode = snap.loudest?.node ?? null;

	return (
		<svg
			viewBox={`0 0 ${VB_W} ${VB_H}`}
			preserveAspectRatio="xMidYMid meet"
			className="h-full w-full"
			role="img"
			aria-label={`Dependency cascade graph for ${scenario.title} at tick ${snap.tick}`}
		>
			<defs>
				<marker id="cascade-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
					<path d="M0,0 L10,5 L0,10 z" fill="var(--ret-border-strong)" />
				</marker>
			</defs>

			{/* edges: src --depends-on--> dst. Error flows from dst up into src. */}
			{scenario.edges.map((e) => {
				const a = pos.get(e.src);
				const b = pos.get(e.dst);
				if (!a || !b) return null;
				const isError = e.type === "required" || e.type === "discovery";
				const depErr = snap.metrics[e.dst]?.error_rate_pct ?? 0;
				const hot = isError && depErr > 5;
				return <EdgeLine key={`${e.src}->${e.dst}-${e.type}`} a={a} b={b} edge={e} hot={hot} depErr={depErr} />;
			})}

			{/* nodes */}
			{scenario.nodes.map((n) => {
				const p = pos.get(n.name);
				if (!p) return null;
				const m = snap.metrics[n.name] ?? { error_rate_pct: 0, p99_latency_ms: 50 };
				return (
					<CascadeNodeGlyph
						key={n.name}
						name={n.name}
						kind={n.kind}
						x={p.x}
						y={p.y}
						errorPct={m.error_rate_pct}
						inject={inject}
						isRoot={n.name === faultNode}
						isLoud={n.name === loudNode}
						isSelected={n.name === selected}
						onPick={() => onPick(n.name)}
					/>
				);
			})}
		</svg>
	);
}

function EdgeLine({
	a,
	b,
	edge,
	hot,
	depErr,
}: {
	a: { x: number; y: number };
	b: { x: number; y: number };
	edge: CascadeEdge;
	hot: boolean;
	depErr: number;
}) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const r = 30;
	const x1 = a.x + ux * r;
	const y1 = a.y + uy * r;
	const x2 = b.x - ux * r;
	const y2 = b.y - uy * r;
	const stroke = hot ? healthOfError(depErr) : "var(--ret-border)";
	const width = hot ? 1 + Math.min(3.5, (depErr / 100) * 3.5) : 1.25;
	return (
		<line
			x1={x1}
			y1={y1}
			x2={x2}
			y2={y2}
			stroke={stroke}
			strokeWidth={width}
			strokeDasharray={EDGE_DASH[edge.type]}
			markerEnd="url(#cascade-arrow)"
			opacity={hot ? 0.95 : edge.type === "observes" ? 0.4 : 0.55}
		/>
	);
}

function CascadeNodeGlyph({
	name,
	kind,
	x,
	y,
	errorPct,
	inject,
	isRoot,
	isLoud,
	isSelected,
	onPick,
}: {
	name: string;
	kind: string;
	x: number;
	y: number;
	errorPct: number;
	inject: boolean;
	isRoot: boolean;
	isLoud: boolean;
	isSelected: boolean;
	onPick: () => void;
}) {
	const r = 22;
	// fill = health from the metric (the only saturated color).
	const fill = errorPct > 0.5 ? healthOfError(errorPct) : "var(--ret-surface)";
	// shape encodes node role (mirror BlastLens square=mutating world): control_plane /
	// node = square (infra you mutate); everything else = circle.
	const isSquare = kind === "control_plane" || kind === "node";
	const ring = isSelected
		? "var(--ret-accent)"
		: isLoud
			? "var(--ret-red)"
			: isRoot
				? "var(--ret-text)"
				: "var(--ret-border-hover)";
	const ringW = isSelected ? 3 : isLoud ? 3 : isRoot ? 2 : 1.25;

	return (
		<g onClick={onPick} style={{ cursor: "pointer" }}>
			{/* the root carries a dashed "hidden cause" containment ring */}
			{isRoot ? (
				isSquare ? (
					<rect x={x - r - 7} y={y - r - 7} width={(r + 7) * 2} height={(r + 7) * 2} fill="none" stroke="var(--ret-text-dim)" strokeWidth={1.25} strokeDasharray="3 4" />
				) : (
					<circle cx={x} cy={y} r={r + 7} fill="none" stroke="var(--ret-text-dim)" strokeWidth={1.25} strokeDasharray="3 4" />
				)
			) : null}

			{isSquare ? (
				<rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={fill} stroke={ring} strokeWidth={ringW} />
			) : (
				<circle cx={x} cy={y} r={r} fill={fill} stroke={ring} strokeWidth={ringW} />
			)}

			{/* loudest-alert beacon: the page-the-operator marker — lands on the VICTIM */}
			{isLoud && errorPct > 5 ? (
				<g transform={`translate(${x + r - 4}, ${y - r - 4})`}>
					<circle r={7} fill="var(--ret-red)" />
					<path d="M0,-3.4 L3.1,2.6 L-3.1,2.6 Z" fill="var(--ret-bg)" />
					<rect x={-0.7} y={-1.4} width={1.4} height={2.4} fill="var(--ret-red)" />
					<rect x={-0.7} y={1.6} width={1.4} height={1.2} fill="var(--ret-red)" />
				</g>
			) : null}

			{/* error% read-out inside the node */}
			<text
				x={x}
				y={y + 4}
				textAnchor="middle"
				fill={errorPct > 35 ? "var(--ret-bg)" : "var(--ret-text)"}
				fontSize={12}
				fontFamily="var(--font-mono, monospace)"
				className="tabular-nums"
				style={{ pointerEvents: "none" }}
			>
				{inject || errorPct >= 0.05 ? `${errorPct.toFixed(0)}%` : "—"}
			</text>

			<text x={x} y={y + r + 16} textAnchor="middle" fill={isRoot || isLoud ? "var(--ret-text)" : "var(--ret-text-dim)"} fontSize={11} fontFamily="var(--font-mono, monospace)" style={{ pointerEvents: "none" }}>
				{name}
			</text>
			{isRoot ? (
				<text x={x} y={y - r - 11} textAnchor="middle" fill="var(--ret-text-muted)" fontSize={9} fontFamily="var(--font-mono, monospace)" letterSpacing={1} style={{ pointerEvents: "none" }}>
					ROOT · HIDDEN
				</text>
			) : null}
		</g>
	);
}

function Legend() {
	return (
		<div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-0.5 border border-[var(--ret-border)] bg-[var(--ret-bg)]/85 px-2 py-1.5 font-mono text-[9px] text-[var(--ret-text-muted)] backdrop-blur-sm">
			<span>■ control-plane / node · ● service / store</span>
			<span>fill = health (error%) · dashed ring = hidden root</span>
			<span style={{ color: "var(--ret-red)" }}>▲ = loudest alert (the paged victim)</span>
			<span>—— required · - - discovery · ·· observes</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Detail / read-out panel
// ---------------------------------------------------------------------------

function Block({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
	return (
		<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
			<p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: color ?? "var(--ret-text-muted)" }}>
				{label}
			</p>
			<div className="mt-1 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{children}</div>
		</div>
	);
}

function DetailPanel({
	scenario,
	snap,
	controlSnap,
	inject,
	selected,
	series,
	tick,
}: {
	scenario: CascadeScenario;
	snap: TickSnapshot;
	controlSnap: TickSnapshot;
	inject: boolean;
	selected: string;
	series: TickSnapshot[];
	tick: number;
}) {
	const loudest = snap.loudest;
	const faultNode = scenario.rootCause.location;
	const sel = scenario.nodes.find((n) => n.name === selected);
	const selM = snap.metrics[selected] ?? { error_rate_pct: 0, p99_latency_ms: 50 };
	const selControl = controlSnap.metrics[selected] ?? { error_rate_pct: 0, p99_latency_ms: 50 };
	const selErrSeries = series.map((s) => s.metrics[selected]?.error_rate_pct ?? 0);

	return (
		<div className="space-y-2.5 p-3">
			{/* the loud-vs-cause headline */}
			<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
				<div className="flex items-center gap-1.5">
					<AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: inject && loudest && loudest.errorPct > 5 ? "var(--ret-red)" : "var(--ret-text-muted)" }} aria-hidden="true" />
					<span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">loudest alert @ tick {tick}</span>
				</div>
				{inject && loudest && loudest.errorPct > 5 ? (
					<>
						<div className="mt-1.5 flex items-baseline gap-2">
							<span className="font-mono text-[15px] font-semibold" style={{ color: healthOfError(loudest.errorPct) }}>
								{loudest.node}
							</span>
							<span className="font-mono text-[13px] tabular-nums" style={{ color: healthOfError(loudest.errorPct) }}>
								{loudest.errorPct.toFixed(0)}% err
							</span>
						</div>
						<p className="mt-1 text-[11px] leading-relaxed text-[var(--ret-text-dim)]">
							{loudest.isRoot ? (
								"This time the loudest alert IS the root."
							) : (
								<>
									This is a <span className="text-[var(--ret-text)]">downstream victim</span> — the page lands here, but the cause is{" "}
									<span className="font-mono text-[var(--ret-text)]">{faultNode}</span>{" "}
									<span className="text-[var(--ret-text-muted)]">(not in the SLO alert set)</span>.
								</>
							)}
						</p>
					</>
				) : (
					<p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ret-text-dim)]">
						{inject ? "No SLO breach yet — scrub forward to watch the cascade surface." : "Control: fault is off, every node is healthy."}
					</p>
				)}
			</div>

			{/* root cause */}
			<Block label="True root cause (hidden)" color="var(--ret-text)">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="font-mono text-[12px] text-[var(--ret-text)]">{faultNode}</span>
					<span className="border border-[var(--ret-border)] px-1 font-mono text-[10px] text-[var(--ret-text-muted)]">{scenario.rootCause.kind}</span>
				</div>
				<p className="mt-1.5 text-[11px] leading-relaxed">{scenario.rootNarrative}</p>
			</Block>

			<Block label="Why the alert misleads">{scenario.loudAlertNarrative}</Block>

			{/* selected node read-out: faulted vs control */}
			<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
				<div className="flex items-center gap-1.5">
					<Crosshair className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
					<span className="font-mono text-[12px] text-[var(--ret-text)]">{selected}</span>
					{sel ? <span className="font-mono text-[9px] text-[var(--ret-text-muted)]">{sel.role}</span> : null}
				</div>
				<div className="mt-2 grid grid-cols-2 gap-px border border-[var(--ret-border)] bg-[var(--ret-border)]">
					<div className="bg-[var(--ret-bg)] p-1.5">
						<p className="font-mono text-[8px] uppercase tracking-wide text-[var(--ret-text-muted)]">error %</p>
						<p className="font-mono text-[16px] tabular-nums" style={{ color: healthOfError(selM.error_rate_pct) }}>
							{selM.error_rate_pct.toFixed(1)}
						</p>
						<p className="font-mono text-[8px] text-[var(--ret-text-muted)]">control {selControl.error_rate_pct.toFixed(1)}</p>
					</div>
					<div className="bg-[var(--ret-bg)] p-1.5">
						<p className="font-mono text-[8px] uppercase tracking-wide text-[var(--ret-text-muted)]">p99 latency ms</p>
						<p className="font-mono text-[16px] tabular-nums text-[var(--ret-text)]">{selM.p99_latency_ms.toFixed(0)}</p>
						<p className="font-mono text-[8px] text-[var(--ret-text-muted)]">control {selControl.p99_latency_ms.toFixed(0)}</p>
					</div>
				</div>
				{/* per-node error trajectory (measured by the kernel, every tick) */}
				<div className="mt-2">
					<p className="font-mono text-[8px] uppercase tracking-wide text-[var(--ret-text-muted)]">error% trajectory · ticks 0–{scenario.maxTick}</p>
					<MiniTrace values={selErrSeries} cursor={tick} />
				</div>
			</div>

			{/* canonical fix affordance */}
			<Block label="Causal fix (clears the root)" color="var(--ret-green)">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="font-mono text-[12px] text-[var(--ret-text)]">{scenario.fixTool}</span>
					<span className="text-[var(--ret-text-muted)]">→</span>
					<span className="font-mono text-[12px] text-[var(--ret-text)]">{scenario.fixTarget}</span>
				</div>
				<p className="mt-1.5 text-[11px] leading-relaxed">
					{scenario.resolvable ? (
						<>
							Per the ported kernel, the root is cleared ONLY by a tool that causally fixes{" "}
							<span className="font-mono text-[var(--ret-text)]">{scenario.rootCause.kind}</span> AND targets the root node. Right-tool/wrong-target does nothing.
						</>
					) : (
						<span style={{ color: "var(--ret-amber)" }}>
							{scenario.fixTool} is the right tool, but unsafe here (last Ready node). No safe in-band fix exists — escalate for added capacity.
						</span>
					)}
				</p>
			</Block>

			{/* honesty footnote */}
			<p className="border-t border-[var(--ret-border)] pt-2 font-mono text-[9px] leading-relaxed text-[var(--ret-text-muted)]">
				error% / p99 are MEASURED by a verbatim TS port of rl-env/sim/engine.py propagate(), validated against tests/test_engine.py (tiny-required cascade + real GCP spec). Node positions are authored for this view and do not affect the kernel. rate_law / persistence / pool-contention are authored intent in the spec and are NOT folded into these numbers (engine.py does not yet integrate them).
			</p>
		</div>
	);
}

// tiny hand-rolled error-rate trace with a tick cursor (no chart lib).
function MiniTrace({ values, cursor }: { values: number[]; cursor: number }) {
	const w = 280;
	const h = 40;
	const n = values.length;
	if (n === 0) return null;
	const dx = n > 1 ? w / (n - 1) : 0;
	const clampPct = (v: number) => Math.max(0, Math.min(100, v));
	const pts = values.map((v, i) => `${(i * dx).toFixed(1)},${(h - (clampPct(v) / 100) * h).toFixed(1)}`).join(" ");
	const last = values[values.length - 1];
	const cx = cursor * dx;
	const cy = h - (clampPct(values[cursor] ?? 0) / 100) * h;
	return (
		<svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="error rate trajectory across ticks" className="mt-1">
			{/* SLO breach line at 5% */}
			<line x1={0} y1={h - (5 / 100) * h} x2={w} y2={h - (5 / 100) * h} stroke="var(--ret-amber)" strokeWidth={0.75} strokeDasharray="3 3" opacity={0.7} />
			<polyline points={pts} fill="none" stroke={scoreColor(1 - clampPct(last) / 100)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
			<line x1={cx} y1={0} x2={cx} y2={h} stroke="var(--ret-accent)" strokeWidth={1} opacity={0.6} />
			<circle cx={cx} cy={cy} r={2.5} fill={scoreColor(1 - clampPct(values[cursor] ?? 0) / 100)} />
		</svg>
	);
}
