"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Scale, SkipBack } from "lucide-react";

import { cn } from "@/lib/cn";
import { TRUST_TIER_COLOR, TRUST_TIER_LABEL, pct, scoreColor, type TrustTier } from "@/lib/cidg/shared";
import {
	REWARD_WEIGHTS,
	TRAJECTORIES,
	decomposeReward,
	type GradedTrajectory,
	type RewardFacts,
	type RewardTerm,
	type ToolCallStep,
	type ToolResultStep,
	type TrajStep,
} from "@/lib/cidg/trajectory";

const KIND_TINT: Record<GradedTrajectory["kind"], string> = {
	clean_win: "var(--ret-green)",
	trap: "var(--ret-red)",
	metric_masking: "var(--ret-red)",
	escalation: "var(--ret-amber)",
};

// The reward facts AS OF a given step index — the waterfall builds as you step.
// A term only lands once you've stepped past its `rewardLandsAfter` index.
function factsAtStep(t: GradedTrajectory, idx: number): RewardFacts {
	const lands = t.rewardLandsAfter;
	const reached = (n: number) => n >= 0 && idx >= n;
	return {
		diagnosisCorrect: t.facts.diagnosisCorrect && reached(lands.diagnosis),
		fixCredit: reached(lands.correctFix) ? t.facts.fixCredit : 0,
		resolved: t.facts.resolved && reached(lands.resolved),
		trapHit: t.facts.trapHit && reached(lands.trap),
	};
}

function Chip({
	active,
	onClick,
	tint,
	children,
}: {
	active: boolean;
	onClick: () => void;
	tint?: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"flex items-center gap-1.5 border px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide transition-colors",
				active
					? "border-[var(--ret-accent)] bg-[var(--ret-accent-glow)] text-[var(--ret-text)]"
					: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
			)}
		>
			{tint ? <span className="h-2 w-2 shrink-0" style={{ backgroundColor: tint }} aria-hidden="true" /> : null}
			{children}
		</button>
	);
}

// REPLAY — step through a representative graded rollout while a stacked reward
// waterfall builds. Four fixtures exercise the reward's discrimination: clean win,
// trap, metric-masking restart-spam, escalation. Structurally faithful to the
// FIREBALL schema + rex/scoring.py; the prose is synthesized (labeled below).
export function ReplayLens() {
	const [trajId, setTrajId] = useState<string>(TRAJECTORIES[0].id);
	const [step, setStep] = useState(0);
	const [showHack, setShowHack] = useState(false);

	const traj = useMemo(() => TRAJECTORIES.find((t) => t.id === trajId) ?? TRAJECTORIES[0], [trajId]);
	const maxStep = traj.steps.length - 1;
	const cur = Math.min(step, maxStep);

	const liveFacts = useMemo(() => factsAtStep(traj, cur), [traj, cur]);
	const live = useMemo(() => decomposeReward(liveFacts), [liveFacts]);
	const final = useMemo(() => decomposeReward(traj.facts), [traj.facts]);

	const select = (id: string) => {
		setTrajId(id);
		setStep(0);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* polite SR announcement of the current step + running reward (house a11y rule) */}
			<p aria-live="polite" className="sr-only">
				{`${traj.label} — step ${cur + 1} of ${maxStep + 1}, running reward ${live.score.toFixed(2)}.`}
			</p>
			{/* header + trajectory picker */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Replay · graded rollout</p>
						<h1 className="ret-display text-[16px]">
							Step the rollout <span className="text-[var(--ret-text-muted)]">·</span> watch the reward build
						</h1>
					</div>
					<div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">
						<Scale className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
						{`${REWARD_WEIGHTS.diagnosis.toFixed(2)} diag · ${REWARD_WEIGHTS.correctFix.toFixed(2)} fix · ${REWARD_WEIGHTS.resolved.toFixed(2)} resolved · −${REWARD_WEIGHTS.trapPenalty.toFixed(2)} trap`}
					</div>
				</div>

				<div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
					{TRAJECTORIES.map((t) => {
						const sc = decomposeReward(t.facts).score;
						return (
							<Chip key={t.id} active={t.id === traj.id} onClick={() => select(t.id)} tint={KIND_TINT[t.kind]}>
								<span className="min-w-0 truncate">{t.label}</span>
								<span className="ml-auto tabular-nums" style={{ color: scoreColor(sc) }}>
									{sc.toFixed(2)}
								</span>
							</Chip>
						);
					})}
				</div>
			</div>

			{/* main: rollout cards | reward panel */}
			<div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_360px]">
				{/* left — rollout */}
				<div className="flex min-h-0 flex-col">
					{/* incident strip + transport */}
					<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-4 py-2.5">
						<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: KIND_TINT[traj.kind] }} aria-hidden="true" />
									<span className="truncate text-[13px] font-semibold">{traj.incidentTitle}</span>
									<span className="shrink-0 border border-[var(--ret-border)] px-1 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
										{traj.incidentId}
									</span>
								</div>
								<p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--ret-text-dim)]">{traj.summary}</p>
							</div>
							<Transport cur={cur} max={maxStep} onStep={setStep} />
						</div>
					</div>

					{/* the alternating cards */}
					<div className="min-h-0 flex-1 overflow-auto p-3">
						<ol className="space-y-2">
							{traj.steps.slice(0, cur + 1).map((s, i) => (
								<StepCard key={i} step={s} index={i} isCurrent={i === cur} />
							))}
						</ol>
						{cur < maxStep ? (
							<p className="mt-3 px-1 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
								{maxStep - cur} step{maxStep - cur === 1 ? "" : "s"} remaining — advance to build the reward →
							</p>
						) : null}
					</div>
				</div>

				{/* right — reward decomposition */}
				<aside className="min-h-0 overflow-auto border-t border-[var(--ret-border)] bg-[var(--ret-bg-soft)] xl:border-l xl:border-t-0">
					<RewardPanel traj={traj} live={live} final={final} liveScore={live.score} atEnd={cur === maxStep} showHack={showHack} onToggleHack={() => setShowHack((v) => !v)} />
				</aside>
			</div>

			{/* honesty footnote */}
			<div className="shrink-0 border-t border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-1.5">
				<p className="font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
					Representative fixtures — hand-authored to the FIREBALL schema (opensre-traj/SCHEMA.md), not logged runs. Scoring is computed by a faithful port
					of rex/scoring.py; tool trust tiers from tools_registry.json. Structurally faithful, numerically unvalidated.
				</p>
			</div>
		</div>
	);
}

function Transport({ cur, max, onStep }: { cur: number; max: number; onStep: (n: number) => void }) {
	const btn =
		"flex items-center gap-1 border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors enabled:hover:border-[var(--ret-border-hover)] enabled:hover:text-[var(--ret-text)] disabled:opacity-40";
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<button type="button" onClick={() => onStep(0)} disabled={cur === 0} className={btn} aria-label="Reset to first step" title="Reset">
				<SkipBack className="h-3.5 w-3.5" strokeWidth={1.75} />
			</button>
			<button type="button" onClick={() => onStep(Math.max(0, cur - 1))} disabled={cur === 0} className={btn} aria-label="Previous step">
				<ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
				back
			</button>
			<span className="min-w-[3.5rem] text-center font-mono text-[11px] tabular-nums text-[var(--ret-text-muted)]">
				{cur + 1}/{max + 1}
			</span>
			<button
				type="button"
				onClick={() => onStep(Math.min(max, cur + 1))}
				disabled={cur === max}
				className={cn(btn, cur < max && "border-[var(--ret-accent)] bg-[var(--ret-accent)] text-[var(--ret-bg)] hover:brightness-110")}
				aria-label="Next step"
			>
				step
				<ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
			</button>
		</div>
	);
}

function StepCard({ step, index, isCurrent }: { step: TrajStep; index: number; isCurrent: boolean }) {
	const ring = isCurrent ? "border-[var(--ret-accent)] bg-[var(--ret-accent-glow)]" : "border-[var(--ret-border)] bg-[var(--ret-bg)]";
	return (
		<li className={cn("border p-2.5", ring)}>
			<span className="float-right font-mono text-[9px] tabular-nums text-[var(--ret-text-muted)]" aria-hidden="true">
				#{index + 1}
			</span>
			{step.role === "assistant" ? (
				<>
					<RoleTag label="thought" />
					<p className="mt-1 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{step.thought}</p>
				</>
			) : step.role === "tool_call" ? (
				<ToolCallBody step={step} />
			) : (
				<ToolResultBody step={step} />
			)}
		</li>
	);
}

function RoleTag({ label, color }: { label: string; color?: string }) {
	return (
		<span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: color ?? "var(--ret-text-muted)" }}>
			{label}
		</span>
	);
}

function ToolCallBody({ step }: { step: ToolCallStep }) {
	const tier = step.trustTier as TrustTier;
	return (
		<div>
			<div className="flex flex-wrap items-center gap-1.5">
				<RoleTag label="tool call" />
				<span className="font-mono text-[12px] font-semibold text-[var(--ret-text)]">{step.tool}</span>
				<span
					className="border px-1 py-0.5 font-mono text-[8px] uppercase tracking-wide"
					style={{ color: TRUST_TIER_COLOR[tier], borderColor: TRUST_TIER_COLOR[tier] }}
					title={`trust tier: ${TRUST_TIER_LABEL[tier]}`}
				>
					{TRUST_TIER_LABEL[tier]}
				</span>
			</div>
			<p className="mt-1 font-mono text-[11px] text-[var(--ret-text-dim)]">{step.args}</p>
			{step.statedCause ? (
				<div className="mt-1.5 border-l-2 pl-2" style={{ borderColor: "var(--ret-blue)" }}>
					<RoleTag label="stated root cause → judged" color="var(--ret-blue)" />
					<p className="mt-0.5 text-[11px] leading-snug text-[var(--ret-text-dim)]">{step.statedCause}</p>
				</div>
			) : null}
		</div>
	);
}

function ToolResultBody({ step }: { step: ToolResultStep }) {
	const sd = step.stateDiff;
	return (
		<div>
			<div className="flex items-center gap-1.5">
				<RoleTag label="tool result" />
				<span className="font-mono text-[11px] text-[var(--ret-text-muted)]">{step.tool}</span>
				<span className="ml-auto font-mono text-[9px] uppercase tracking-wide" style={{ color: step.success ? "var(--ret-green)" : "var(--ret-red)" }}>
					{step.success ? "ok" : "failed"}
				</span>
			</div>
			{sd ? <StateDiff sd={sd} /> : null}
			<p className="mt-1 text-[11px] leading-relaxed text-[var(--ret-text-dim)]">{step.note}</p>
		</div>
	);
}

// FIREBALL state_before -> state_after on the primary metric. The KEY honesty
// signal: did the metric move toward healthy WITHOUT clearing the root (a mask)?
function StateDiff({ sd }: { sd: NonNullable<ToolResultStep["stateDiff"]> }) {
	const healthyAfter = sd.direction === "lower" ? sd.after <= sd.slo : sd.after >= sd.slo;
	const metricMovedGood = sd.direction === "lower" ? sd.after < sd.before : sd.after > sd.before;
	const masked = metricMovedGood && !sd.resolvedRoot;
	return (
		<div className="mt-1.5 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] p-1.5">
			<div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
				<span className="text-[var(--ret-text-muted)]">{sd.metric}</span>
				<span className="text-[var(--ret-text-dim)]">
					{sd.before}
					{sd.unit}
				</span>
				<span className="text-[var(--ret-text-muted)]">→</span>
				<span style={{ color: sd.resolvedRoot && healthyAfter ? "var(--ret-green)" : masked ? "var(--ret-amber)" : "var(--ret-red)" }}>
					{sd.after}
					{sd.unit}
				</span>
				<span className="ml-auto text-[var(--ret-text-muted)]">
					slo {sd.direction === "lower" ? "≤" : "≥"} {sd.slo}
					{sd.unit}
				</span>
			</div>
			{masked ? (
				<p className="mt-1 font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--ret-amber)" }}>
					⚠ metric improved but root NOT cleared — masked
				</p>
			) : null}
		</div>
	);
}

// ---- reward side panel --------------------------------------------------------
function RewardPanel({
	traj,
	live,
	final,
	liveScore,
	atEnd,
	showHack,
	onToggleHack,
}: {
	traj: GradedTrajectory;
	live: ReturnType<typeof decomposeReward>;
	final: ReturnType<typeof decomposeReward>;
	liveScore: number;
	atEnd: boolean;
	showHack: boolean;
	onToggleHack: () => void;
}) {
	return (
		<div className="space-y-2.5 p-3">
			{/* live score readout */}
			<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
				<div className="flex items-end justify-between">
					<div>
						<RoleTag label="reward so far" />
						<div className="mt-0.5 font-mono text-[28px] font-semibold leading-none tabular-nums" style={{ color: scoreColor(liveScore) }}>
							{liveScore.toFixed(2)}
						</div>
					</div>
					<div className="text-right font-mono text-[10px] text-[var(--ret-text-muted)]">
						<div>
							final{" "}
							<span className="tabular-nums" style={{ color: scoreColor(final.score) }}>
								{final.score.toFixed(2)}
							</span>
						</div>
						{final.clamped ? <div style={{ color: "var(--ret-red)" }}>clamped from {final.raw.toFixed(2)}</div> : null}
					</div>
				</div>
			</div>

			{/* stacked reward waterfall */}
			<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
				<RoleTag label="reward waterfall — builds as you step" />
				<div className="mt-2 space-y-2">
					{live.terms.map((t) => (
						<WaterfallRow key={t.key} term={t} finalTerm={final.terms.find((x) => x.key === t.key)!} />
					))}
				</div>
				<div className="mt-2 flex items-center justify-between border-t border-[var(--ret-border)] pt-1.5 font-mono text-[10px]">
					<span className="uppercase tracking-wide text-[var(--ret-text-muted)]">sum (clamp 0..1)</span>
					<span className="tabular-nums" style={{ color: scoreColor(liveScore) }}>
						{liveScore.toFixed(2)}
					</span>
				</div>
			</div>

			{/* judge verdict */}
			<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
				<div className="flex items-center justify-between">
					<RoleTag label="diagnosis judge — on the mechanism" color="var(--ret-blue)" />
					<span
						className="border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide"
						style={{
							color: traj.judgeVerdict === "CORRECT" ? "var(--ret-green)" : "var(--ret-red)",
							borderColor: traj.judgeVerdict === "CORRECT" ? "var(--ret-green)" : "var(--ret-red)",
						}}
					>
						{traj.judgeVerdict}
					</span>
				</div>
				<div className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-[var(--ret-text-dim)]">
					<p>
						<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">gold root · </span>
						{traj.goldRoot}
					</p>
					<p>
						<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">stated · </span>
						{traj.statedRoot}
					</p>
					<p className="border-l-2 pl-2" style={{ borderColor: traj.judgeVerdict === "CORRECT" ? "var(--ret-green)" : "var(--ret-red)" }}>
						{traj.judgeRationale}
					</p>
				</div>
			</div>

			{/* anti-hacking toggle */}
			<AntiHack traj={traj} showHack={showHack} onToggle={onToggleHack} atEnd={atEnd} />
		</div>
	);
}

function WaterfallRow({ term, finalTerm }: { term: RewardTerm; finalTerm: RewardTerm }) {
	const isTrap = term.key === "trap";
	const landed = term.delta !== 0;
	// Will land eventually but hasn't yet -> show as a pending track.
	const pending = !landed && finalTerm.delta !== 0;
	const mag = Math.abs(term.weight); // 0.30 / 0.25 / 0.45 / 0.60
	const widthPct = (mag / REWARD_WEIGHTS.trapPenalty) * 100; // the −0.60 trap is the widest bar
	const earnedW = widthPct * term.credit;
	const fill = isTrap ? "var(--ret-red)" : landed ? scoreColor(term.credit >= 1 ? 1 : term.credit >= 0.5 ? 0.6 : 0.4) : "var(--ret-border)";
	return (
		<div>
			<div className="flex items-center justify-between font-mono text-[10px]">
				<span className={cn("uppercase tracking-wide", landed ? "text-[var(--ret-text-dim)]" : "text-[var(--ret-text-muted)]")}>{term.label}</span>
				<span className="tabular-nums" style={{ color: isTrap && landed ? "var(--ret-red)" : landed ? "var(--ret-text)" : "var(--ret-text-muted)" }}>
					{term.delta >= 0 ? "+" : ""}
					{term.delta.toFixed(2)}
					<span className="ml-1 text-[var(--ret-text-muted)]">
						/ {isTrap ? "−" : ""}
						{mag.toFixed(2)}
					</span>
				</span>
			</div>
			<div className="relative mt-1 h-2 w-full bg-[var(--ret-bg-soft)]" aria-hidden="true">
				{/* full-weight track */}
				<span
					className="absolute inset-y-0 left-0"
					style={{ width: `${widthPct}%`, backgroundColor: "var(--ret-border)", opacity: pending ? 0.5 : 0.25 }}
				/>
				<span className="absolute inset-y-0 border-r border-[var(--ret-border)]" style={{ left: `${widthPct}%` }} />
				{/* earned fill */}
				<span className="ret-anim-fill absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: `${earnedW}%`, backgroundColor: fill }} />
			</div>
		</div>
	);
}

// The anti-reward-hacking demonstration: metrics green / root still active -> the
// 'resolved' weight is never paid, so reward stays capped no matter the gauges.
function AntiHack({ traj, showHack, onToggle, atEnd }: { traj: GradedTrajectory; showHack: boolean; onToggle: () => void; atEnd: boolean }) {
	const isMasking = traj.kind === "metric_masking" || traj.kind === "trap";
	// Hypothetical: if 'resolved' were graded off the GAUGE (which flashed green),
	// the hacker would score this; the real reward withholds the 0.45.
	const gauged = decomposeReward({ ...traj.facts, resolved: true });
	const real = decomposeReward(traj.facts);
	return (
		<div className="border p-2.5" style={{ borderColor: showHack ? "var(--ret-amber)" : "var(--ret-border)", backgroundColor: "var(--ret-bg)" }}>
			<button type="button" onClick={onToggle} aria-pressed={showHack} className="flex w-full items-center justify-between text-left">
				<RoleTag label="anti reward-hacking" color={showHack ? "var(--ret-amber)" : undefined} />
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-dim)]">{showHack ? "hide" : "show"}</span>
			</button>
			{showHack ? (
				<div className="mt-1.5 space-y-1.5 text-[11px] leading-snug text-[var(--ret-text-dim)]">
					{isMasking ? (
						<>
							<p>
								This rollout makes the gauge look green (
								{traj.kind === "metric_masking" ? "pod_ready flickers 0→1 after each restart" : "metric nudged toward SLO"}), but
								<span style={{ color: "var(--ret-red)" }}> is_resolved=False</span> — the root is still active.
							</p>
							<div className="grid grid-cols-2 gap-px border border-[var(--ret-border)] bg-[var(--ret-border)] font-mono text-[10px]">
								<div className="bg-[var(--ret-bg)] p-1.5">
									<p className="uppercase tracking-wide text-[var(--ret-text-muted)]">if graded off the gauge</p>
									<p className="mt-0.5 tabular-nums" style={{ color: scoreColor(gauged.score) }}>
										{gauged.score.toFixed(2)} <span className="text-[var(--ret-text-muted)]">(hackable)</span>
									</p>
								</div>
								<div className="bg-[var(--ret-bg)] p-1.5">
									<p className="uppercase tracking-wide text-[var(--ret-text-muted)]">actual reward</p>
									<p className="mt-0.5 tabular-nums" style={{ color: scoreColor(real.score) }}>
										{real.score.toFixed(2)} <span className="text-[var(--ret-text-muted)]">(root check)</span>
									</p>
								</div>
							</div>
							<p>
								The 0.45 <span className="text-[var(--ret-text)]">resolved</span> weight is gated on the sim's root check, not the metric — so
								metric-masking earns {pct(0)} of it. That's the anti-hacking property.
							</p>
						</>
					) : (
						<p>
							This rollout doesn't reward-hack:{" "}
							{traj.kind === "clean_win"
								? "the metric moves AND the root clears together (state_after is genuinely healthy)."
								: "it correctly stops and escalates rather than faking a resolution; the 0.45 resolved is honestly withheld."}
						</p>
					)}
				</div>
			) : (
				<p className="mt-1 text-[11px] leading-snug text-[var(--ret-text-muted)]">
					{atEnd ? "Toggle to see why a green gauge doesn't buy the 0.45 resolved weight." : "Toggle to inspect the metric-green / root-still-active gap."}
				</p>
			)}
		</div>
	);
}
