"use client";

import { cn } from "@/lib/cn";
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

	return (
		<div className={cn("flex h-full flex-col", className)}>
			<div className="flex items-center justify-between border-b border-[var(--ret-border)] px-3 py-2">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Evidence ledger</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{entries.length}</span>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
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
