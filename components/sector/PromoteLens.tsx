"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { eligible, TIER_LABEL, TIER_RANK, TIERS } from "@/lib/promotion";

import { AgentCard } from "./AgentCard";
import { AutonomyChip } from "./AutonomyChip";
import { CandidateDossier } from "./CandidateDossier";
import { useLens } from "./LensProvider";
import { TierLane } from "./TierLane";
import { STATUS_COLOR_VAR } from "./visual";

const TOP0 = 84; // below the lane header
const GAP = 128; // vertical stride per token
const TOKEN_H = 112;

// The Autonomy Launch Track: position = autonomy. Tokens (reused AgentCard L1)
// are absolutely placed by tier+slot; a tier change animates the lane slide via
// a pure CSS transition. Promotion fires an accent release pulse + earcon.
export function PromoteLens({ className }: { className?: string }) {
	const { state, selectCandidate, promote, hold, rollback, clearCeremony } = useLens();
	const { agents, promoteSelectedId, promotingId, demotingId } = state;

	// stable slot per agent (sorted by name within tier so only tier changes move)
	const { slots, counts } = useMemo(() => {
		const slots = new Map<string, { ti: number; slot: number }>();
		const counts = [0, 0, 0, 0];
		for (const tier of TIERS) {
			const members = agents.filter((a) => a.autonomyTier === tier).sort((a, b) => a.name.localeCompare(b.name));
			members.forEach((m, i) => slots.set(m.id, { ti: TIER_RANK[tier], slot: i }));
			counts[TIER_RANK[tier]] = members.length;
		}
		return { slots, counts };
	}, [agents]);

	const candidate = agents.find((a) => a.id === promoteSelectedId) ?? null;
	const maxSlots = Math.max(1, ...counts);
	const trackHeight = TOP0 + maxSlots * GAP + 24;

	// Measure the track width so tokens can be positioned with a compositor-friendly
	// transform (translate) instead of animating left/top layout properties.
	const wrapRef = useRef<HTMLDivElement>(null);
	const [trackW, setTrackW] = useState(1200);
	useLayoutEffect(() => {
		const el = wrapRef.current;
		if (!el) return;
		const measure = () => setTrackW(el.getBoundingClientRect().width);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);
	const laneWidth = trackW / 4;

	// default candidate: the most-ready non-autonomous agent
	useEffect(() => {
		if (promoteSelectedId) return;
		const best = [...agents]
			.filter((a) => a.autonomyTier !== "autonomous")
			.sort((a, b) => b.readiness - a.readiness)[0];
		if (best) selectCandidate(best.id);
	}, [promoteSelectedId, agents, selectCandidate]);

	// auto-clear a ceremony after it plays
	useEffect(() => {
		if (!promotingId && !demotingId) return;
		const t = window.setTimeout(() => clearCeremony(), 950);
		return () => window.clearTimeout(t);
	}, [promotingId, demotingId, clearCeremony]);

	const ceremonyAgent = agents.find((a) => a.id === (promotingId ?? demotingId)) ?? null;

	return (
		<div className={cn("ret-promote relative flex h-full min-h-0 flex-col bg-[var(--ret-bg)]", className)}>
			{/* screen-reader announcement of the latest tier change */}
			<div aria-live="polite" className="sr-only">
				{state.ledger[0]
					? `${state.ledger[0].agentName} ${TIER_RANK[state.ledger[0].toTier] > TIER_RANK[state.ledger[0].fromTier] ? "promoted to" : "demoted to"} ${TIER_LABEL[state.ledger[0].toTier]}`
					: ""}
			</div>
			{/* track */}
			<div className="relative min-h-0 flex-1 overflow-auto">
				<div ref={wrapRef} className="relative min-w-[760px]" style={{ height: trackHeight, minHeight: "100%" }}>
					{/* lane backgrounds */}
					<div className="absolute inset-0 grid grid-cols-4">
						{TIERS.map((tier) => (
							<TierLane key={tier} tier={tier} count={counts[TIER_RANK[tier]]} />
						))}
					</div>

					{/* gate markers between lanes */}
					{[1, 2, 3].map((g) => (
						<div
							key={g}
							className="pointer-events-none absolute top-0 bottom-0 z-10 flex flex-col items-center"
							style={{ left: `${g * 25}%`, transform: "translateX(-50%)" }}
						>
							<span className="mt-1.5 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-1 font-mono text-[8px] uppercase text-[var(--ret-text-muted)]">
								gate {g}
							</span>
							<span className="mt-1 w-px flex-1 bg-[var(--ret-border)]/60" />
						</div>
					))}

					{/* token layer */}
					<div className="absolute inset-0 z-20">
						{agents.map((a) => {
							const pos = slots.get(a.id);
							if (!pos) return null;
							const isCandidate = a.id === promoteSelectedId;
							const isCeremony = a.id === promotingId || a.id === demotingId;
							return (
								<button
									key={a.id}
									type="button"
									onClick={() => selectCandidate(a.id)}
									aria-label={`${a.name}, ${TIER_LABEL[a.autonomyTier]}, readiness ${Math.round(a.readiness)}, ${a.status}`}
									data-ceremony={isCeremony ? "1" : undefined}
									className={cn(
										"ret-token absolute left-0 top-0 block text-left outline-none transition-transform duration-[600ms] ease-out",
										"focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]",
									)}
									style={{
										width: `${laneWidth - 24}px`,
										height: TOKEN_H,
										transform: `translate(${pos.ti * laneWidth + 12}px, ${TOP0 + pos.slot * GAP}px)`,
									}}
								>
									<div className={cn("relative h-full", isCandidate && "z-10")}>
										<AgentCard agent={a} level="L1" selected={isCandidate} />
										{/* readiness bar */}
										<span className="absolute inset-x-0 bottom-0 block h-[3px] bg-[var(--ret-border)]/60" aria-hidden="true">
											<span
												className={cn("block h-full", eligible(a) ? "bg-[var(--ret-accent)]" : "bg-[var(--ret-text-dim)]")}
												style={{ width: `${a.readiness}%` }}
											/>
										</span>
										<span className="absolute right-1 top-1">
											<AutonomyChip tier={a.autonomyTier} compact showBar={false} />
										</span>
										{/* guardrail bracket — the auto-rollback promise of GUARDED */}
										{a.autonomyTier === "guarded" ? (
											<>
												<span aria-hidden="true" className="pointer-events-none absolute -left-0.5 bottom-3 top-3 w-2 border-y border-l border-[var(--ret-border-strong)]" />
												<span aria-hidden="true" className="pointer-events-none absolute -right-0.5 bottom-3 top-3 w-2 border-y border-r border-[var(--ret-border-strong)]" />
											</>
										) : null}
									</div>
								</button>
							);
						})}
					</div>

					{/* promotion ceremony pulse */}
					{promotingId && ceremonyAgent
						? (() => {
								const pos = slots.get(ceremonyAgent.id);
								if (!pos) return null;
								return (
									<span
										key={`pulse-${promotingId}`}
										className="ret-promote-pulse pointer-events-none absolute z-30"
										style={{ left: `${pos.ti * 25}%`, top: `${TOP0 + pos.slot * GAP + TOKEN_H / 2}px` }}
										aria-hidden="true"
									/>
								);
							})()
						: null}

					{/* demotion ceremony — health-colored ring (a real health event) */}
					{demotingId && ceremonyAgent
						? (() => {
								const pos = slots.get(ceremonyAgent.id);
								if (!pos) return null;
								return (
									<span
										key={`demote-${demotingId}`}
										className="ret-health-ring pointer-events-none absolute z-30 block h-28 w-28 border-2"
										style={{
											left: `calc(${pos.ti} * 25% + 12%)`,
											top: `${TOP0 + pos.slot * GAP + TOKEN_H / 2}px`,
											transform: "translate(-50%, -50%)",
											borderColor: STATUS_COLOR_VAR[ceremonyAgent.status],
										}}
										aria-hidden="true"
									/>
								);
							})()
						: null}

					{/* signature beat — guardrail dissolves + "oversight removed" on T2->T3 */}
					{promotingId && ceremonyAgent?.autonomyTier === "autonomous"
						? (() => {
								const pos = slots.get(ceremonyAgent.id);
								if (!pos) return null;
								return (
									<div
										key={`final-${promotingId}`}
										className="pointer-events-none absolute z-40"
										style={{ left: `calc(${pos.ti} * 25% + 12px)`, top: `${TOP0 + pos.slot * GAP}px`, width: "calc(25% - 24px)", height: TOKEN_H }}
										aria-hidden="true"
									>
										<span className="ret-bracket-dissolve absolute -left-0.5 bottom-3 top-3 w-2 border-y border-l border-[var(--ret-accent)]" />
										<span className="ret-bracket-dissolve absolute -right-0.5 bottom-3 top-3 w-2 border-y border-r border-[var(--ret-accent)]" />
										<span className="ret-shatter absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ret-accent)]">
											oversight removed
										</span>
									</div>
								);
							})()
						: null}
				</div>
			</div>

			{/* docked candidate dossier */}
			<CandidateDossier
				agent={candidate}
				onPromote={() => candidate && promote(candidate.id)}
				onHold={() => candidate && hold(candidate.id)}
				onRollback={() => candidate && rollback(candidate.id)}
			/>
		</div>
	);
}
