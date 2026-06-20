"use client";

import { cn } from "@/lib/cn";
import { blockingReason, eligible, gateProgress, GATES, nextTier, TIER_LABEL } from "@/lib/promotion";
import type { SreAgent } from "@/lib/sre-data";

import { GateCriterion } from "./GateCriterion";
import { HeartbeatDot } from "./HeartbeatDot";
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
	if (!agent) return null;
	const to = nextTier(agent.autonomyTier);
	const ok = eligible(agent);
	const reason = blockingReason(agent);
	const criteria = gateProgress(agent);
	const requiredEnv = to ? GATES[agent.autonomyTier].requiredEnv : undefined;
	const lastLine = agent.terminalLines[agent.terminalLines.length - 1];

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

				<PromoteControls agent={agent} onPromote={onPromote} onHold={onHold} onRollback={onRollback} />
			</div>

			{/* verifiable criteria */}
			{criteria.length > 0 ? (
				<div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
					{criteria.map((c) => (
						<GateCriterion key={c.id} criterion={c} />
					))}
				</div>
			) : null}

			{lastLine ? (
				<div className="mt-1.5 truncate font-mono text-[10px] text-[var(--ret-text-muted)]">
					<span className="text-[var(--ret-text-dim)]">{agent.provingEnv}</span> · {lastLine}
				</div>
			) : null}
		</div>
	);
}
