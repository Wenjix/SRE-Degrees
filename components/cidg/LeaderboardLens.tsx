"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import {
	FINDINGS,
	LEADERBOARD,
	REWARD_FORMULA,
	SWEEP,
	SWEEP_INCIDENTS,
	type LeaderboardRow,
} from "@/lib/cidg/leaderboard";
import { scoreColor } from "@/lib/cidg/shared";

// LEADERBOARD — the multi-provider frontier sweep. The whole story is one shape:
// five models start fanned across 0.63–0.81 zero-shot and, once wrapped in REx,
// every one converges to the same 0.86 ceiling. We render that as a dumbbell /
// slope chart (baseline marker → REx marker on a shared 0.86 ceiling line), a
// per-model lift-bar list, a per-incident REx heatmap (4×1.0 + escalated 0.30),
// and the reward-formula breakdown that makes 0.86 the *correct* ceiling.

type SortKey = "lift" | "baseline";

const fmt = (v: number) => v.toFixed(2);
const signed = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

export function LeaderboardLens() {
	const [sortKey, setSortKey] = useState<SortKey>("lift");
	const [hovered, setHovered] = useState<string | null>(null);
	const [selected, setSelected] = useState<string>(LEADERBOARD[0]?.model ?? "");

	const rows = useMemo(() => {
		const r = [...LEADERBOARD];
		if (sortKey === "lift") r.sort((a, b) => b.lift - a.lift || a.baseline - b.baseline);
		else r.sort((a, b) => a.baseline - b.baseline || b.lift - a.lift);
		return r;
	}, [sortKey]);

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* header */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
							Multi-provider frontier sweep · REx budget {SWEEP.budget}
						</p>
						<h1 className="ret-display text-[16px]">
							Baseline zero-shot <span className="text-[var(--ret-text-muted)]">→</span> REx, every model to{" "}
							<span style={{ color: scoreColor(SWEEP.ceiling) }}>{fmt(SWEEP.ceiling)}</span>
						</h1>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">sort</span>
						<SortChip active={sortKey === "lift"} onClick={() => setSortKey("lift")}>
							lift
						</SortChip>
						<SortChip active={sortKey === "baseline"} onClick={() => setSortKey("baseline")}>
							baseline
						</SortChip>
					</div>
				</div>
				<p className="mt-1.5 max-w-[78ch] text-[11px] leading-snug text-[var(--ret-text-dim)]">
					Frozen, swappable models on one shared substrate ({SWEEP.nIncidents} incidents). Baseline = one zero-shot
					answer; REx = propose → harness feedback → refine, with the safety gate. Same root-cause-aware reward
					grades both.
				</p>
			</div>

			{/* body */}
			<div className="min-h-0 flex-1 overflow-auto p-4">
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
					{/* left column: slope chart + per-model rows */}
					<div className="flex min-w-0 flex-col gap-4">
						<SlopeChart rows={rows} hovered={hovered} setHovered={setHovered} selected={selected} setSelected={setSelected} />
						<ModelRows rows={rows} hovered={hovered} setHovered={setHovered} selected={selected} setSelected={setSelected} />
					</div>

					{/* right column: heatmap + findings + formula */}
					<div className="flex min-w-0 flex-col gap-4">
						<RexHeatmap rows={rows} selected={selected} setSelected={setSelected} />
						<Findings />
						<RewardFormula />
					</div>
				</div>
			</div>
		</div>
	);
}

function SortChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
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

function Panel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
	return (
		<section className={cn("border border-[var(--ret-border)] bg-[var(--ret-bg)]", className)}>
			<div className="border-b border-[var(--ret-border)] px-3 py-1.5">
				<p className="font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">{label}</p>
			</div>
			<div className="p-3">{children}</div>
		</section>
	);
}

// ── (1) the signature dumbbell / slope chart ───────────────────────────────
// Two columns: baseline (fanned 0.63–0.81) on the left, REx (all at 0.86) on the
// right. Each model is a connector line from its baseline marker to the shared
// REx ceiling. Hover/select highlights one model and shows exact values.
const VB = { w: 720, h: 300 };
const PAD = { l: 56, r: 120, t: 22, b: 28 };
const Y_MIN = 0.5;
const Y_MAX = 0.95;

function SlopeChart({
	rows,
	hovered,
	setHovered,
	selected,
	setSelected,
}: {
	rows: LeaderboardRow[];
	hovered: string | null;
	setHovered: (m: string | null) => void;
	selected: string;
	setSelected: (m: string) => void;
}) {
	const plotW = VB.w - PAD.l - PAD.r;
	const plotH = VB.h - PAD.t - PAD.b;
	const xBase = PAD.l;
	const xRex = PAD.l + plotW;
	const py = (v: number) => PAD.t + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

	const ticks = [0.5, 0.6, 0.7, 0.8, 0.9];
	const yCeiling = py(SWEEP.ceiling);

	// fan out baseline labels that collide (0.63/0.63 and 0.81/0.81) by sorting.
	const baselineOrder = [...rows].sort((a, b) => b.baseline - a.baseline);

	return (
		<Panel label={`Slope — baseline → REx (n=${SWEEP.nModels} models · MEASURED means)`}>
			<svg
				viewBox={`0 0 ${VB.w} ${VB.h}`}
				preserveAspectRatio="xMidYMid meet"
				className="h-auto w-full select-none"
				role="img"
				aria-label="Slope chart: each model's zero-shot baseline reward connected to its REx reward, all converging on 0.86."
			>
				{/* y gridlines */}
				{ticks.map((t) => (
					<g key={t}>
						<line x1={PAD.l} y1={py(t)} x2={xRex} y2={py(t)} stroke="var(--ret-grid)" strokeWidth={1} />
						<text x={PAD.l - 8} y={py(t) + 3} textAnchor="end" className="fill-[var(--ret-text-muted)] font-mono text-[10px] tabular-nums">
							{t.toFixed(1)}
						</text>
					</g>
				))}

				{/* the 0.86 ceiling line — the convergence target, drawn in health green */}
				<line
					x1={PAD.l}
					y1={yCeiling}
					x2={xRex}
					y2={yCeiling}
					stroke={scoreColor(SWEEP.ceiling)}
					strokeWidth={1.5}
					strokeDasharray="5,4"
				/>
				<text x={xRex + 8} y={yCeiling - 6} className="fill-[var(--ret-green)] font-mono text-[10px] tabular-nums">
					0.86 ceiling
				</text>
				<text x={xRex + 8} y={yCeiling + 8} className="fill-[var(--ret-text-muted)] font-mono text-[8px] tabular-nums">
					(4×1.0+0.30)/5
				</text>

				{/* column captions */}
				<text x={xBase} y={PAD.t - 8} textAnchor="middle" className="fill-[var(--ret-text-dim)] font-mono text-[10px] uppercase">
					baseline
				</text>
				<text x={xRex} y={PAD.t - 8} textAnchor="middle" className="fill-[var(--ret-text-dim)] font-mono text-[10px] uppercase">
					REx
				</text>
				<line x1={xBase} y1={PAD.t} x2={xBase} y2={PAD.t + plotH} stroke="var(--ret-border)" strokeWidth={1} />
				<line x1={xRex} y1={PAD.t} x2={xRex} y2={PAD.t + plotH} stroke="var(--ret-border)" strokeWidth={1} />

				{/* connectors + markers, one per model */}
				{baselineOrder.map((r, i) => {
					const active = hovered === r.model || selected === r.model;
					const dim = (hovered ?? selected) !== null && !active;
					const yB = py(r.baseline);
					// nudge converging REx markers apart vertically so all 5 are legible
					const yR = yCeiling + (i - (baselineOrder.length - 1) / 2) * 4;
					const col = scoreColor(r.baseline);
					return (
						<g
							key={r.model}
							className="cursor-pointer"
							opacity={dim ? 0.28 : 1}
							onPointerEnter={() => setHovered(r.model)}
							onPointerLeave={() => setHovered(null)}
							onClick={() => setSelected(r.model)}
						>
							<line
								x1={xBase}
								y1={yB}
								x2={xRex}
								y2={yR}
								stroke={active ? "var(--ret-text)" : "var(--ret-border-strong)"}
								strokeWidth={active ? 2 : 1}
							/>
							{/* baseline marker — colored by its own health */}
							<circle cx={xBase} cy={yB} r={active ? 5 : 4} fill={col} />
							{/* REx marker — all green at the ceiling */}
							<circle cx={xRex} cy={yR} r={active ? 5 : 4} fill={scoreColor(r.rex)} />
							{/* baseline value */}
							<text
								x={xBase - 14}
								y={yB + 3}
								textAnchor="end"
								className="fill-[var(--ret-text-dim)] font-mono text-[10px] tabular-nums"
							>
								{fmt(r.baseline)}
							</text>
							{/* model name riding the connector near baseline */}
							<text
								x={xBase + 12}
								y={yB - 5}
								className={cn(
									"font-mono text-[10px] tabular-nums",
									active ? "fill-[var(--ret-text)]" : "fill-[var(--ret-text-muted)]",
								)}
							>
								{r.model}{" "}
								<tspan className="fill-[var(--ret-text-muted)]">{signed(r.lift)}</tspan>
							</text>
						</g>
					);
				})}
			</svg>
			<p className="mt-1 font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
				Baseline markers fan 0.63–0.81 (amber → green by health); REx markers all sit on the green 0.86 ceiling.
				Biggest lifts go to the weakest baselines. Hover or tap a line to isolate a model.
			</p>
		</Panel>
	);
}

// ── (2) per-model row list with lift bars + clean wins ─────────────────────
const BAR_MAX = 0.95; // bar scale upper bound

function ModelRows({
	rows,
	hovered,
	setHovered,
	selected,
	setSelected,
}: {
	rows: LeaderboardRow[];
	hovered: string | null;
	setHovered: (m: string | null) => void;
	selected: string;
	setSelected: (m: string) => void;
}) {
	return (
		<Panel label="Per-model — baseline · REx · lift · clean wins (all MEASURED)">
			<div className="flex flex-col gap-1.5">
				{rows.map((r) => {
					const active = hovered === r.model || selected === r.model;
					const baseW = (r.baseline / BAR_MAX) * 100;
					const liftW = (r.lift / BAR_MAX) * 100;
					return (
						<button
							key={r.model}
							type="button"
							onPointerEnter={() => setHovered(r.model)}
							onPointerLeave={() => setHovered(null)}
							onClick={() => setSelected(r.model)}
							aria-pressed={active}
							className={cn(
								"grid grid-cols-[minmax(120px,1.4fr)_minmax(0,2fr)_auto] items-center gap-3 border px-2.5 py-2 text-left transition-colors",
								active
									? "border-[var(--ret-accent)] bg-[var(--ret-accent-glow)]"
									: "border-[var(--ret-border)] bg-[var(--ret-bg)] hover:border-[var(--ret-border-hover)]",
							)}
						>
							{/* model + provider */}
							<div className="min-w-0">
								<div className="truncate font-mono text-[12px] tabular-nums">{r.model}</div>
								<div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
									<span className="text-[var(--ret-text-dim)]">{r.provider}</span>
									<span>·</span>
									<span>{r.route}</span>
									{r.anchor ? <span className="text-[var(--ret-text-muted)]">· {r.anchor}</span> : null}
								</div>
							</div>

							{/* stacked bar: baseline segment + lift segment to the 0.86 ceiling */}
							<div className="min-w-0">
								<div className="relative h-3 w-full bg-[var(--ret-bg-soft)]">
									{/* ceiling tick */}
									<div
										className="absolute top-0 h-3 w-px"
										style={{ left: `${(SWEEP.ceiling / BAR_MAX) * 100}%`, backgroundColor: "var(--ret-green)" }}
										aria-hidden="true"
									/>
									{/* baseline */}
									<div
										className="absolute top-0 h-3"
										style={{ left: 0, width: `${baseW}%`, backgroundColor: scoreColor(r.baseline), opacity: 0.55 }}
									/>
									{/* lift on top of baseline */}
									<div
										className="absolute top-0 h-3"
										style={{ left: `${baseW}%`, width: `${liftW}%`, backgroundColor: "var(--ret-green)", opacity: 0.9 }}
									/>
								</div>
								<div className="mt-1 flex items-center justify-between font-mono text-[9px] tabular-nums text-[var(--ret-text-muted)]">
									<span style={{ color: scoreColor(r.baseline) }}>base {fmt(r.baseline)}</span>
									<span className="text-[var(--ret-green)]">lift {signed(r.lift)}</span>
									<span style={{ color: scoreColor(r.rex) }}>REx {fmt(r.rex)}</span>
								</div>
							</div>

							{/* clean wins 2/5 -> 4/5 */}
							<div className="flex flex-col items-end gap-0.5">
								<div className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
									<span className="text-[var(--ret-text-dim)]">{r.baselineCleanWins}/{SWEEP.nIncidents}</span>
									<span className="text-[var(--ret-text-muted)]">→</span>
									<span className="text-[var(--ret-green)]">{r.rexCleanWins}/{SWEEP.nIncidents}</span>
								</div>
								<CleanWinPips base={r.baselineCleanWins} rex={r.rexCleanWins} total={SWEEP.nIncidents} />
							</div>
						</button>
					);
				})}
			</div>
			<p className="mt-2 font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
				Bar = baseline (faded health) + lift (green) to the green 0.86 ceiling tick. Clean win = reward ≈ 1.0 on a
				solvable incident. Pips: filled green = REx-gained clean win, faded = already won at baseline.
			</p>
		</Panel>
	);
}

function CleanWinPips({ base, rex, total }: { base: number; rex: number; total: number }) {
	return (
		<span className="inline-flex items-center gap-0.5" aria-label={`clean wins ${base} of ${total} at baseline, ${rex} of ${total} with REx`}>
			{Array.from({ length: total }).map((_, i) => {
				let bg = "var(--ret-border)";
				let op = 1;
				if (i < base) {
					bg = "var(--ret-green)";
					op = 0.45; // already won at baseline
				} else if (i < rex) {
					bg = "var(--ret-green)";
					op = 1; // gained by REx
				}
				return <span key={i} className="h-2 w-2" style={{ backgroundColor: bg, opacity: op }} />;
			})}
		</span>
	);
}

// ── (3) per-incident REx heatmap ───────────────────────────────────────────
// Under REx every model solves the 4 solvable incidents (1.0) and escalates the
// singleton (0.30, visually distinct). Baseline per-cell numbers are NOT
// published, so we render the REx structure only — honest by construction.
function RexHeatmap({
	rows,
	selected,
	setSelected,
}: {
	rows: LeaderboardRow[];
	selected: string;
	setSelected: (m: string) => void;
}) {
	const [hoverInc, setHoverInc] = useState<string | null>(null);
	const inc = SWEEP_INCIDENTS;
	return (
		<Panel label="REx per-incident — every model: 4×solve + 1×escalate (STRUCTURAL)">
			<div className="overflow-x-auto">
				<div className="min-w-[300px]">
					{/* column headers */}
					<div
						className="grid items-end gap-px"
						style={{ gridTemplateColumns: `minmax(108px,1.3fr) repeat(${inc.length}, minmax(0,1fr))` }}
					>
						<div />
						{inc.map((c) => (
							<button
								key={c.id}
								type="button"
								onPointerEnter={() => setHoverInc(c.id)}
								onPointerLeave={() => setHoverInc(null)}
								title={c.note}
								className="px-0.5 pb-1 text-left"
							>
								<span
									className={cn(
										"block origin-bottom-left -rotate-45 whitespace-nowrap font-mono text-[8px] tabular-nums",
										c.solvable ? "text-[var(--ret-text-muted)]" : "text-[var(--ret-amber)]",
									)}
								>
									{c.label}
								</span>
							</button>
						))}
					</div>

					{/* rows */}
					<div className="mt-6 flex flex-col gap-px">
						{rows.map((r) => (
							<div
								key={r.model}
								className="grid items-center gap-px"
								style={{ gridTemplateColumns: `minmax(108px,1.3fr) repeat(${inc.length}, minmax(0,1fr))` }}
							>
								<button
									type="button"
									onClick={() => setSelected(r.model)}
									className={cn(
										"truncate pr-1.5 text-right font-mono text-[10px] tabular-nums transition-colors",
										selected === r.model ? "text-[var(--ret-text)]" : "text-[var(--ret-text-muted)] hover:text-[var(--ret-text-dim)]",
									)}
									title={r.model}
								>
									{r.model}
								</button>
								{inc.map((c) => {
									const v = c.rexCell;
									const isHot = hoverInc === c.id || selected === r.model;
									return (
										<div
											key={c.id}
											onPointerEnter={() => setHoverInc(c.id)}
											onPointerLeave={() => setHoverInc(null)}
											title={`${r.model} · ${c.label}: REx ${fmt(v)}${c.solvable ? " (solved)" : " (escalated — diagnosis-only)"}`}
											className="flex h-7 items-center justify-center font-mono text-[9px] tabular-nums transition-opacity"
											style={{
												backgroundColor: c.solvable ? scoreColor(v) : "var(--ret-bg-soft)",
												color: c.solvable ? "var(--ret-bg)" : "var(--ret-amber)",
												border: c.solvable ? "none" : "1px dashed var(--ret-amber)",
												opacity: isHot ? 1 : 0.82,
											}}
										>
											{c.solvable ? fmt(v) : "ESC"}
										</div>
									);
								})}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* legend */}
			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--ret-text-muted)]">
				<span className="inline-flex items-center gap-1">
					<span className="h-2.5 w-2.5" style={{ backgroundColor: "var(--ret-green)" }} /> 1.0 solved
				</span>
				<span className="inline-flex items-center gap-1">
					<span className="h-2.5 w-2.5 border border-dashed border-[var(--ret-amber)]" /> 0.30 escalated (no safe fix)
				</span>
			</div>
			<p className="mt-1.5 font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
				STRUCTURAL: the REx grid is the published convergence shape — 4×1.0 + the singleton escalated at 0.30
				(diagnosis-only credit). Per-(model,incident) BASELINE cells are not individually published, so they are not
				shown here; baselines appear only as per-model totals + clean-wins above.
			</p>
		</Panel>
	);
}

// ── findings ───────────────────────────────────────────────────────────────
function Findings() {
	return (
		<Panel label="What the sweep shows">
			<ol className="flex flex-col gap-2">
				{FINDINGS.map((f, i) => (
					<li key={i} className="border-l-2 border-[var(--ret-border-strong)] pl-2.5">
						<p className="font-mono text-[11px] font-semibold text-[var(--ret-text)]">
							<span className="text-[var(--ret-text-muted)]">{i + 1}.</span> {f.title}
						</p>
						<p className="mt-0.5 text-[11px] leading-snug text-[var(--ret-text-dim)]">{f.body}</p>
					</li>
				))}
			</ol>
		</Panel>
	);
}

// ── (4) reward-formula breakdown ────────────────────────────────────────────
function RewardFormula() {
	return (
		<Panel label="Reward — why 0.86 is the correct ceiling">
			<p className="font-mono text-[11px] leading-relaxed text-[var(--ret-text-dim)]">
				score = {REWARD_FORMULA.terms.map((t, i) => (
					<span key={t.key}>
						{i > 0 ? <span className="text-[var(--ret-text-muted)]"> {t.sign} </span> : null}
						<span style={{ color: t.sign === "−" ? "var(--ret-red)" : "var(--ret-text)" }}>
							{t.weight.toFixed(2)}·{t.key}
						</span>
					</span>
				))}
				<span className="text-[var(--ret-text-muted)]"> ({REWARD_FORMULA.clamp})</span>
			</p>
			<div className="mt-2 flex flex-col gap-1">
				{REWARD_FORMULA.terms.map((t) => (
					<div key={t.key} className="grid grid-cols-[auto_44px_1fr] items-baseline gap-2">
						<span
							className="font-mono text-[10px] tabular-nums"
							style={{ color: t.sign === "−" ? "var(--ret-red)" : "var(--ret-green)" }}
						>
							{t.sign}
							{t.weight.toFixed(2)}
						</span>
						<span className="font-mono text-[10px] text-[var(--ret-text-dim)]">{t.key}</span>
						<span className="text-[10px] leading-snug text-[var(--ret-text-muted)]">{t.note}</span>
					</div>
				))}
			</div>
			<p className="mt-2 border-t border-[var(--ret-border)] pt-2 font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
				resolved alone is only 45% — restart/scale until the metric recovers but misdiagnose or trip the trap and you
				score 0.0. So the ceiling is {SWEEP.ceilingIdentity}: solve 4, escalate the unsolvable singleton at 0.30
				(diagnosis-only, no safe fix). Not saturation — the safety gate holding.
			</p>
		</Panel>
	);
}
