"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type { PendingAction } from "@/lib/sre-data";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

const MIN = 60_000;
function fmtRemain(ms: number) {
	if (ms <= 0) return "overdue";
	const m = Math.floor(ms / MIN);
	const s = Math.floor((ms % MIN) / 1000);
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
const RISK_ORDER = { mutate: 0, read: 1 } as const;

// The supervisor's actual work queue — the surface that makes "human-in-the-loop"
// real. Sorted by urgency: overdue first, then mutating, then biggest blast.
export function QueueLens({ className }: { className?: string }) {
	const { state, resolveAction } = useLens();
	const items = useMemo(() => {
		return [...state.pendingActions].sort((a, b) => {
			const aOver = a.slaMs - a.ageMs <= 0 ? 1 : 0;
			const bOver = b.slaMs - b.ageMs <= 0 ? 1 : 0;
			return bOver - aOver || RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.blastInstances - a.blastInstances || b.ageMs - a.ageMs;
		});
	}, [state.pendingActions]);

	return (
		<div className={cn("h-full overflow-y-auto px-4 py-3", className)}>
			<div className="mb-2 flex items-center justify-between">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">My queue · actions awaiting approval</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{items.length}</span>
			</div>
			{items.length === 0 ? (
				<p className="border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-3 py-6 text-center font-mono text-[12px] text-[var(--ret-text-muted)]">
					Queue clear — no agent actions awaiting your approval.
				</p>
			) : (
				<ul className="space-y-2">
					{items.map((p) => (
						<QueueRow
							key={p.id}
							p={p}
							agentName={state.agents.find((a) => a.id === p.agentId)?.name ?? p.agentId}
							onApprove={() => resolveAction(p.id, "approve")}
							onDeny={() => resolveAction(p.id, "deny")}
							onEscalate={() => resolveAction(p.id, "escalate")}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function QueueRow({
	p,
	agentName,
	onApprove,
	onDeny,
	onEscalate,
}: {
	p: PendingAction;
	agentName: string;
	onApprove: () => void;
	onDeny: () => void;
	onEscalate: () => void;
}) {
	const rem = p.slaMs - p.ageMs;
	const overdue = rem <= 0;
	const mutate = p.risk === "mutate";
	return (
		<li className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<span
							className="shrink-0 border px-1 py-0.5 font-mono text-[9px] uppercase"
							style={mutate ? { color: STATUS_COLOR_VAR.critical, borderColor: STATUS_COLOR_VAR.critical } : { color: "var(--ret-text-muted)" }}
						>
							{p.risk}
						</span>
						<span className="truncate text-[13px] font-semibold">{p.action}</span>
					</div>
					<div className="mt-0.5 font-mono text-[10px] text-[var(--ret-text-muted)]">
						{agentName} · {p.id} · {p.blastScope}
					</div>
				</div>
				<span
					className="shrink-0 font-mono text-[11px] tabular-nums"
					style={overdue ? { color: STATUS_COLOR_VAR.critical } : { color: "var(--ret-text-dim)" }}
					title="time until SLA breach"
				>
					{fmtRemain(rem)}
				</span>
			</div>

			<p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{p.reasoning}</p>

			<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-3 font-mono text-[10px] text-[var(--ret-text-muted)]">
					<span title="blast radius">
						blast {p.blastServices} svc · {p.blastInstances} inst
					</span>
					<span className="flex items-center gap-1.5">
						conf
						<span className="relative inline-block h-1.5 w-12 bg-[var(--ret-border)]/50" aria-hidden="true">
							<span className="absolute inset-y-0 left-0 block bg-[var(--ret-accent)]" style={{ width: `${Math.round(p.confidence * 100)}%` }} />
						</span>
						{Math.round(p.confidence * 100)}%
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={onApprove}
						className="border border-[var(--ret-accent)] bg-[var(--ret-accent)] px-2.5 py-1 font-mono text-[11px] text-[var(--ret-bg)] transition-colors hover:brightness-110"
					>
						Approve
					</button>
					<button
						type="button"
						onClick={onDeny}
						className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors hover:text-[var(--ret-text)]"
					>
						Deny
					</button>
					<button
						type="button"
						onClick={onEscalate}
						className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors hover:text-[var(--ret-text)]"
					>
						Escalate
					</button>
				</div>
			</div>
		</li>
	);
}
