"use client";

import { BadgeCheck, Check, GraduationCap, Lock } from "lucide-react";

import { cn } from "@/lib/cn";
import { capstoneFor, credentialFor, credentialShortFor, incidentCredits } from "@/lib/credentials";
import { blockingReason, eligible, gateProgress, GATES, nextTier, TIER_LABEL } from "@/lib/promotion";
import { formatScore, rexEvidenceForAgent, rexLift } from "@/lib/rex-evidence";
import { SEVERITY_LABEL, type SreAgent } from "@/lib/sre-data";

import { GateCriterion } from "./GateCriterion";
import { HeartbeatDot } from "./HeartbeatDot";
import { useLens } from "./LensProvider";
import { PromoteControls } from "./PromoteControls";
import { ProvingStepper } from "./ProvingStepper";

// The docked candidate inspector: trust meter + verifiable criteria + proving
// stepper + the HITL controls. Makes a promotion visibly EARNED.
export function CandidateDossier({
	agent,
	onPromote,
	onHold,
	onRollback,
}: {
	agent: SreAgent | null;
	onPromote: () => void;
	onHold: () => void;
	onRollback: () => void;
}) {
	const { state } = useLens();
	if (!agent) return null;
	const to = nextTier(agent.autonomyTier);
	const ok = eligible(agent);
	const reason = blockingReason(agent);
	const criteria = gateProgress(agent);
	const requiredEnv = to ? GATES[agent.autonomyTier].requiredEnv : undefined;
	const lastLine = agent.terminalLines[agent.terminalLines.length - 1];
	const cap = capstoneFor(agent);
	const credits = incidentCredits(agent.id, state.incidents);
	const rex = rexEvidenceForAgent(agent.id);

	return (
		<div className="shrink-0 border-t border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-2.5">
			<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
				{/* identity + trust meter */}
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<HeartbeatDot status={agent.status} size={10} />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 font-mono text-[12px]">
							<span className="truncate text-[var(--ret-text)]">{agent.name}</span>
							<span className="truncate text-[var(--ret-text-muted)]">
								{agent.id} · {TIER_LABEL[agent.autonomyTier]}
								{to ? ` → ${TIER_LABEL[to]}` : ""}
							</span>
						</div>
						{/* degree framing — current credential + the one being read for */}
						<div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
							<GraduationCap className="h-3 w-3 shrink-0 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
							<span className="text-[var(--ret-text)]">{credentialFor(agent.autonomyTier)}</span>
							<span className="truncate text-[var(--ret-text-muted)]">
								{to ? `· candidate for ${credentialFor(to)} (${credentialShortFor(to)})` : "· terminal degree conferred"}
							</span>
						</div>
						<div className="mt-1 flex items-center gap-2">
							<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">trust</span>
							<span className="relative inline-block h-2 w-48 max-w-[40vw] bg-[var(--ret-border)]/50" aria-hidden="true">
								<span
									className={cn("absolute inset-y-0 left-0 block", ok ? "bg-[var(--ret-accent)]" : "bg-[var(--ret-text-dim)]")}
									style={{ width: `${agent.readiness}%` }}
								/>
								{/* eligibility notch at 100 */}
								<span className="absolute inset-y-0 right-0 w-px bg-[var(--ret-text-muted)]" />
							</span>
							<span className="font-mono text-[10px] tabular-nums text-[var(--ret-text)]">{Math.round(agent.readiness)}/100</span>
							<span className={cn("font-mono text-[10px]", ok ? "text-[var(--ret-green)]" : "text-[var(--ret-text-muted)]")}>
								{to ? (ok ? "· eligible" : reason ? `· ${reason}` : "") : "· operating with no human oversight"}
							</span>
						</div>
						{to ? <ProvingStepper current={agent.provingEnv} required={requiredEnv} className="mt-1.5" /> : null}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{ok && to ? (
						<span
							role="status"
							className="inline-flex shrink-0 items-center gap-1.5 border border-[var(--ret-green)]/50 bg-[var(--ret-green)]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-green)]"
						>
							<Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
							all criteria met
						</span>
					) : null}
					<PromoteControls agent={agent} onPromote={onPromote} onHold={onHold} onRollback={onRollback} />
				</div>
			</div>

			{/* verifiable criteria */}
			{criteria.length > 0 ? (
				<div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
					{criteria.map((c) => (
						<GateCriterion key={c.id} criterion={c} />
					))}
				</div>
			) : null}

			{/* REx proving evidence — calibration data, not a standalone promotion pass. */}
			<div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-[var(--ret-border)] pt-2 sm:grid-cols-4">
				<EvidenceCell label="rex proof" value={`${formatScore(rex.baselineScore)} -> ${formatScore(rex.rexScore)}`} detail={`${rex.model} · lift +${formatScore(rexLift(rex))}`} />
				<EvidenceCell label="clean wins" value={`${rex.baselineCleanWins}/${rex.tasksetSize} -> ${rex.rexCleanWins}/${rex.tasksetSize}`} detail="solvable incidents corrected" />
				<EvidenceCell label="ceiling" value={formatScore(rex.ceilingScore)} detail={`singleton escalation ${formatScore(rex.singletonEscalationScore)}`} />
				<EvidenceCell label="coverage" value={`${rex.tasksetSize} incidents`} detail={`${rex.status} calibration`} />
			</div>
			<div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">rex · proof, not luck — baseline → rex at ceiling</div>

			{/* capstone — the distinct, discipline-specific certification scenario */}
			{to ? (
				<div className="mt-1.5 font-mono text-[10px] text-[var(--ret-text-muted)]">
					<span className="text-[var(--ret-text-dim)]">capstone</span>{" "}
					<span className="border border-[var(--ret-border)] px-1 py-0.5 text-[9px] uppercase tracking-wide text-[var(--ret-text-dim)]">{cap.discipline}</span>{" "}
					<span className="text-[var(--ret-text)]">{cap.capstone}</span>{" "}
					<span className="text-[var(--ret-text-muted)]">→ {credentialShortFor(to)}</span>
				</div>
			) : null}

			{/* transcript — what this agent has learned from past incidents */}
			<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-[var(--ret-text-muted)]">
				<span className="text-[var(--ret-text-dim)]">transcript</span>
				{credits.length === 0 ? (
					<span>clean — no incidents in window</span>
				) : (
					credits.map((c) => (
						<span key={c.id} className="inline-flex items-center gap-1 whitespace-nowrap">
							{c.status === "credit" ? <BadgeCheck className="h-3 w-3 text-[var(--ret-text-dim)]" strokeWidth={1.75} aria-hidden="true" /> : <Lock className="h-3 w-3 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />} {c.id}{" "}
							{c.status === "credit" ? (
								<span className="text-[var(--ret-text-dim)]">recovered · +live-fire credit</span>
							) : (
								<span>{SEVERITY_LABEL[c.severity]} active · probation</span>
							)}
						</span>
					))
				)}
			</div>

			{lastLine ? (
				<div className="mt-1.5 truncate font-mono text-[10px] text-[var(--ret-text-muted)]">
					<span className="text-[var(--ret-text-dim)]">{agent.provingEnv}</span> · {lastLine}
				</div>
			) : null}
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
