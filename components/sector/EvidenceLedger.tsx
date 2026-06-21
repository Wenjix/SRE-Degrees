"use client";

import { cn } from "@/lib/cn";
import { policyTraceForAction } from "@/lib/policy-trace";
import { TIER_LABEL, TIER_RANK } from "@/lib/promotion";

import { useLens } from "./LensProvider";

function hhmm(ts: number) {
	const d = new Date(ts);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Reverse-chron audit log of every promote / hold / rollback / auto-demote — the
// keyboard/screen-reader source of truth for promotion history.
export function EvidenceLedger({ className }: { className?: string }) {
	const { state } = useLens();
	const entries = state.ledger;
	const policySignals = state.pendingActions
		.map((a) => ({ action: a, trace: policyTraceForAction(a, state.agents) }))
		.filter((x) => x.trace.decision !== "allow")
		.slice(0, 3);

	return (
		<div className={cn("flex h-full flex-col", className)}>
			<div className="flex items-center justify-between border-b border-[var(--ret-border)] px-3 py-2">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Evidence ledger</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{entries.length}</span>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{policySignals.length ? (
					<div className="border-b border-[var(--ret-border)] px-3 py-2">
						<div className="font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">Policy feedback</div>
						<ul className="mt-1 space-y-1">
							{policySignals.map(({ action, trace }) => (
								<li key={action.id} className="border border-[var(--ret-border)]/70 bg-[var(--ret-bg-soft)] px-2 py-1 font-mono">
									<div className="flex items-center justify-between gap-2 text-[10px]">
										<span className="truncate text-[var(--ret-text)]">{action.id} · {trace.decision}</span>
										<span className="shrink-0 text-[var(--ret-text-muted)]">learn</span>
									</div>
									<div className="mt-0.5 truncate text-[9px] text-[var(--ret-text-muted)]">{trace.learningSignal}</div>
								</li>
							))}
						</ul>
					</div>
				) : null}
				{entries.length === 0 ? (
					<p className="px-3 py-4 font-mono text-[10px] text-[var(--ret-text-muted)]">
						No promotions yet. Promote a candidate to record an auditable entry.
					</p>
				) : (
					<ul className="divide-y divide-[var(--ret-border)]">
						{entries.map((e, i) => {
							const up = TIER_RANK[e.toTier] > TIER_RANK[e.fromTier];
							const same = e.toTier === e.fromTier;
							return (
								<li key={`${e.ts}-${i}`} className="px-3 py-2">
									<div className="flex items-center justify-between gap-2 font-mono text-[10px]">
										<span className="text-[var(--ret-text)]">{e.agentName}</span>
										<span className="text-[var(--ret-text-muted)]">{hhmm(e.ts)}</span>
									</div>
									<div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px]">
										<span className={cn(e.actor === "auto" ? "text-[var(--ret-amber)]" : "text-[var(--ret-text-dim)]")}>
											{e.actor === "auto" ? "AUTO" : "OP"}
										</span>
										<span className={cn(up ? "text-[var(--ret-accent)]" : same ? "text-[var(--ret-text-muted)]" : "text-[var(--ret-amber)]")}>
											{TIER_LABEL[e.fromTier]} {same ? "·" : up ? "↑" : "↓"} {TIER_LABEL[e.toTier]}
										</span>
									</div>
									<div className="mt-0.5 truncate font-mono text-[9px] text-[var(--ret-text-muted)]">{e.reason}</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
