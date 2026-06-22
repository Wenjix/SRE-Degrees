"use client";

import { ArrowUpRight, BadgeCheck, GraduationCap, Lock, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Sparkline } from "@/components/dashboard/Sparkline";
import { cn } from "@/lib/cn";
import {
	capstoneFor,
	credentialFor,
	credentialShortFor,
	honorsFor,
	incidentCredits,
	numeralFor,
} from "@/lib/credentials";
import { blockingReason, computeReadiness, eligible, GATES, gateProgress, nextTier } from "@/lib/promotion";
import { formatScore, rexAtCeiling, rexEvidenceForAgent, rexLift } from "@/lib/rex-evidence";
import { SEVERITY_LABEL, severityTone, type SreAgent } from "@/lib/sre-data";

import { ReticleCross } from "../reticle/ReticleCross";
import { AutonomyChip } from "./AutonomyChip";
import { EncodingKey } from "./EncodingKey";
import { GateCriterion } from "./GateCriterion";
import { HeartbeatDot } from "./HeartbeatDot";
import { useLens } from "./LensProvider";
import { PromoteControls } from "./PromoteControls";
import { ProvingStepper } from "./ProvingStepper";
import { STATUS_COLOR_VAR } from "./visual";

// L3' — the SERVICE RECORD. A centered "character profile" the PROMOTE track dims
// behind: the agent's SRE-degree dossier (BG3 character-sheet richness, rendered
// instrument-grade). It reads the same store everything else does and consolidates
// the three things an operator wants on a promotion call: the candidacy meter (the
// honest "EXP bar" — gated, never inevitable), the curriculum (verifiable criteria),
// and the agent's lived history (incident transcript + REx/capstone training).
//
// The thin opener keeps the heavy sheet UNMOUNTED until opened so its reveal and
// meter-sweep replay on every open (key by id remounts on agent switch). Esc /
// backdrop / Close all dismiss; focus is trapped + restored (WCAG 2.4.3 / 2.1.2).
export function ServiceRecord() {
	const { state } = useLens();
	const agent = useMemo(
		() => state.agents.find((a) => a.id === state.recordAgentId) ?? null,
		[state.agents, state.recordAgentId],
	);
	if (!agent) return null;
	return <ServiceRecordSheet key={agent.id} agent={agent} />;
}

function ServiceRecordSheet({ agent }: { agent: SreAgent }) {
	const { state, closeRecord, open, promote, hold, rollback } = useLens();
	const sheetRef = useRef<HTMLElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	const restoreRef = useRef<HTMLElement | null>(null);

	// Esc to close + focus capture/restore (modal a11y), mirroring AgentDossier.
	useEffect(() => {
		restoreRef.current = (document.activeElement as HTMLElement) ?? null;
		const raf = window.requestAnimationFrame(() => closeRef.current?.focus());
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeRecord();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.cancelAnimationFrame(raf);
			window.removeEventListener("keydown", onKey);
			restoreRef.current?.focus?.();
		};
	}, [closeRecord]);

	const to = nextTier(agent.autonomyTier);
	const ok = eligible(agent);
	const reason = blockingReason(agent);
	const readiness = Math.round(computeReadiness(agent));
	const toGo = Math.max(0, 100 - readiness);
	const criteria = gateProgress(agent);
	const requiredEnv = to ? GATES[agent.autonomyTier].requiredEnv : undefined;
	const cap = capstoneFor(agent);
	const credits = incidentCredits(agent.id, state.incidents);
	const rex = rexEvidenceForAgent(agent.id);
	const liveFire = state.incidents.some((i) => i.resolved && i.agentIds.includes(agent.id));
	const honors = honorsFor(agent, liveFire);
	const incidentById = useMemo(() => new Map(state.incidents.map((i) => [i.id, i])), [state.incidents]);

	// One-shot candidacy sweep: 0 -> value on open (scaleX, compositor-friendly).
	const [meterW, setMeterW] = useState(0);
	useEffect(() => {
		const raf = window.requestAnimationFrame(() => setMeterW(readiness));
		return () => window.cancelAnimationFrame(raf);
	}, [readiness]);

	// Trap Tab within the sheet (cycle first <-> last focusable).
	const onTrap = (e: ReactKeyboardEvent<HTMLElement>) => {
		if (e.key !== "Tab") return;
		const root = sheetRef.current;
		if (!root) return;
		const nodes = root.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		const list = Array.from(nodes).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
		if (list.length === 0) return;
		const first = list[0];
		const last = list[list.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};

	return (
		<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
			<div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={closeRecord} aria-hidden="true" />
			<div role="status" aria-live="polite" className="sr-only">
				{agent.name} service record
			</div>
			<section
				ref={sheetRef}
				role="dialog"
				aria-modal="true"
				aria-label={`${agent.name} service record`}
				tabIndex={-1}
				onKeyDown={onTrap}
				className="ret-record-in relative z-10 flex max-h-full w-full max-w-[56rem] flex-col border border-[var(--ret-border)] bg-[var(--ret-bg)] focus:outline-none"
			>
				{/* drafting corner-marks — the sheet reads as a plotted instrument */}
				<ReticleCross className="absolute" style={{ top: -10, left: -10 }} />
				<ReticleCross className="absolute" style={{ top: -10, right: -10 }} />
				<ReticleCross className="absolute" style={{ bottom: -10, left: -10 }} />
				<ReticleCross className="absolute" style={{ bottom: -10, right: -10 }} />

				{/* header — crest + identity + degree */}
				<div className="flex shrink-0 items-start gap-3 border-b border-[var(--ret-border)] px-5 py-4">
					{/* degree seal (the SRE-Degrees crest at rest); pulses once if eligible */}
					<span className="relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--ret-text)]">
						<span className="absolute inset-[3px] rounded-full border border-[var(--ret-border-strong)]" aria-hidden="true" />
						<span className="font-mono text-[15px] font-semibold tracking-[0.06em] text-[var(--ret-text)]">{numeralFor(agent.autonomyTier)}</span>
						{ok ? <span className="ret-promote-pulse absolute" style={{ width: 56, height: 56, left: "50%", top: "50%" }} aria-hidden="true" /> : null}
					</span>

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<HeartbeatDot status={agent.status} size={10} />
							<span className="ret-display truncate text-[20px] leading-none">{agent.name}</span>
							<span className="shrink-0 font-mono text-[10px] uppercase tracking-wide" style={{ color: STATUS_COLOR_VAR[agent.status] }}>
								{agent.status}
							</span>
						</div>
						<div className="mt-1 truncate font-mono text-[10px] text-[var(--ret-text-dim)]">
							{agent.id} · {agent.host} · {agent.region}
						</div>
						<div className="mt-1.5 flex flex-wrap items-center gap-2">
							<span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[var(--ret-text)]">
								<GraduationCap className="h-3.5 w-3.5 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
								{credentialFor(agent.autonomyTier)}
							</span>
							<span className="border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-dim)]">
								{cap.discipline}
							</span>
							<AutonomyChip tier={agent.autonomyTier} readiness={agent.autonomyTier === "autonomous" ? undefined : readiness} />
						</div>
					</div>

					<button
						ref={closeRef}
						type="button"
						onClick={closeRecord}
						aria-label="Close service record"
						className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--ret-border)] text-[var(--ret-text-dim)] outline-none transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
					>
						<X className="h-3.5 w-3.5" strokeWidth={1.75} />
					</button>
				</div>

				{/* candidacy meter — the honest "EXP bar": gated, never inevitable */}
				<div className="shrink-0 border-b border-[var(--ret-border)] px-5 py-3">
					<div className="flex items-baseline justify-between gap-3">
						<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ret-text-muted)]">Candidacy</span>
						<span className="font-mono text-[10px] tabular-nums text-[var(--ret-text-dim)]" title={to ? `${credentialFor(agent.autonomyTier)} → ${credentialFor(to)}` : "terminal degree"}>
							{to ? `${credentialShortFor(agent.autonomyTier)} → ${credentialShortFor(to)}` : "terminal degree"}
						</span>
					</div>
					{to ? (
						<>
							<div className="mt-2 flex items-center gap-3">
								<span className="relative h-2.5 flex-1 bg-[var(--ret-border)]/50" aria-hidden="true">
									<span
										className={cn("ret-meter-fill absolute inset-y-0 left-0 block w-full origin-left", ok ? "bg-[var(--ret-accent)]" : "bg-[var(--ret-text-dim)]")}
										style={{ transform: `scaleX(${meterW / 100})` }}
									/>
									{/* eligibility notch at 100 — the bar can sit near it yet stay HELD */}
									<span className="absolute inset-y-0 right-0 w-px bg-[var(--ret-text-muted)]" />
								</span>
								<span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--ret-text)]">
									{readiness}
									<span className="text-[var(--ret-text-muted)]">/100</span>
								</span>
							</div>
							<div className="mt-1.5 font-mono text-[10px]">
								{ok ? (
									<span className="text-[var(--ret-green)]">eligible — ready for conferral of {credentialFor(to)}</span>
								) : reason ? (
									<span className="text-[var(--ret-text-muted)]">
										<span className="text-[var(--ret-text)]">HELD</span> · {reason} · {toGo} to candidacy
									</span>
								) : (
									<span className="text-[var(--ret-text-muted)]">{toGo} to candidacy</span>
								)}
							</div>
						</>
					) : (
						<p className="mt-2 font-mono text-[10px] text-[var(--ret-text-dim)]">
							Doctor of SRE — operating with no human oversight. Trust is still revocable.
						</p>
					)}
				</div>

				{/* body — curriculum (left) · transcript + training (right) */}
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="grid gap-5 p-5 md:grid-cols-2">
						{/* LEFT — curriculum */}
						<div className="space-y-3">
							<Section title="Curriculum · verifiable criteria">
								{criteria.length > 0 ? (
									<div className="grid grid-cols-2 gap-1.5">
										{criteria.map((c) => (
											<GateCriterion key={c.id} criterion={c} />
										))}
									</div>
								) : (
									<p className="font-mono text-[10px] text-[var(--ret-text-dim)]">Curriculum complete — terminal degree conferred.</p>
								)}
							</Section>
							{to ? (
								<Section title="Proving ground">
									<ProvingStepper current={agent.provingEnv} required={requiredEnv} className="flex-wrap" />
								</Section>
							) : null}
						</div>

						{/* RIGHT — transcript + training */}
						<div className="space-y-3">
							<Section title="Transcript · incidents worked">
								{credits.length === 0 ? (
									<p className="font-mono text-[10px] text-[var(--ret-text-dim)]">Clean — no incidents in the current window.</p>
								) : (
									<ul className="space-y-1">
										{credits.map((c, i) => {
											const inc = incidentById.get(c.id);
											const sevColor = STATUS_COLOR_VAR[severityTone(c.severity)];
											return (
												<li
													key={c.id}
													className="ret-record-row flex items-center gap-2 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5"
													style={{ animationDelay: `${i * 45}ms` }}
												>
													{c.status === "credit" ? (
														<BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--ret-text-dim)]" strokeWidth={1.75} aria-hidden="true" />
													) : (
														<Lock className="h-3.5 w-3.5 shrink-0 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
													)}
													<span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--ret-text)]">{c.id}</span>
													<span className="shrink-0 font-mono text-[9px] uppercase tracking-wide" style={{ color: sevColor }}>
														{SEVERITY_LABEL[c.severity]}
													</span>
													<span className="min-w-0 flex-1 truncate font-mono text-[9px] text-[var(--ret-text-muted)]">
														{c.service}</span>
													<span className="shrink-0 font-mono text-[9px] text-[var(--ret-text-dim)]">{c.status === "credit" ? "live-fire credit" : "probation"}
													</span>
													{inc && inc.burnTrend.length > 1 ? (
														<Sparkline values={inc.burnTrend} width={44} height={16} stroke={sevColor} ariaLabel={`${c.id} burn trend`} className="shrink-0" />
													) : null}
												</li>
											);
										})}
									</ul>
								)}
							</Section>

							<Section title="Training · REx + capstone">
								<div className="grid grid-cols-2 gap-1.5">
									<EvidenceCell
										label="rex proof"
										value={`${formatScore(rex.baselineScore)} → ${formatScore(rex.rexScore)}`}
										detail={`${rex.model} · +${formatScore(rexLift(rex))}${rexAtCeiling(rex) ? " · at ceiling" : ""}`}
									/>
									<EvidenceCell
										label="clean wins"
										value={`${rex.baselineCleanWins}/${rex.tasksetSize} → ${rex.rexCleanWins}/${rex.tasksetSize}`}
										detail="solvable incidents corrected"
									/>
								</div>
								<div className="mt-1.5 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5">
									<div className="flex items-center justify-between gap-2">
										<span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">CIDG capstone</span>
										<span className="shrink-0 border border-[var(--ret-border)] px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-dim)]">
											{cap.discipline}
										</span>
									</div>
									<div className="mt-1 font-mono text-[10px] text-[var(--ret-text)]">{cap.capstone}</div>
									<div className="mt-1 font-mono text-[9px] text-[var(--ret-text-muted)]">
										{agent.capstone.rexScore.toFixed(2)} · {agent.capstone.solved}/{agent.capstone.solvable} solved ·{" "}
										{agent.capstone.escalated ? "escalated" : "no escalation"} · {agent.capstone.trapsTripped} trap
										{agent.capstone.trapsTripped === 1 ? "" : "s"} · {agent.capstone.heldOut ? "held-out" : "not held-out"}
									</div>
								</div>
								{honors ? (
									<div className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ret-text-muted)]">— {honors} —</div>
								) : null}
							</Section>
						</div>
					</div>
				</div>

				{/* footer — cross-link to the operational record + the HITL ritual */}
				<div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--ret-border)] px-5 py-3">
					<div className="flex flex-col gap-1">
						<button
							type="button"
							onClick={() => open(agent.id)}
							className="inline-flex items-center gap-1 self-start font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-dim)] outline-none transition-colors hover:text-[var(--ret-text)] focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
						>
							Operational dossier <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
						</button>
						<EncodingKey items={[{ label: "color = health" }, { label: "ink = autonomy" }, { label: "meter = candidacy" }]} />
					</div>
					<PromoteControls
						agent={agent}
						onPromote={() => promote(agent.id)}
						onHold={() => hold(agent.id)}
						onRollback={() => rollback(agent.id)}
					/>
				</div>
			</section>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">{title}</div>
			{children}
		</div>
	);
}

function EvidenceCell({ label, value, detail }: { label: string; value: string; detail: string }) {
	return (
		<div className="min-w-0 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5">
			<div className="truncate font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">{label}</div>
			<div className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[var(--ret-text)]">{value}</div>
			<div className="mt-0.5 truncate font-mono text-[9px] text-[var(--ret-text-muted)]">{detail}</div>
		</div>
	);
}
