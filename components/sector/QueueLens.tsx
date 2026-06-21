"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

// An action is high-blast when it is mutating and has a large scope or touches prod.
function isHighBlast(p: PendingAction): boolean {
	return p.risk === "mutate" && (p.blastInstances > 8 || /prod/i.test(p.blastScope));
}

// The supervisor's actual work queue — the surface that makes "human-in-the-loop"
// real. Sorted by urgency: overdue first, then mutating, then biggest blast.
export function QueueLens({ className }: { className?: string }) {
	const { state, resolveAction } = useLens();
	const items = [...state.pendingActions].sort((a, b) => {
		const aOver = a.slaMs - a.ageMs <= 0 ? 1 : 0;
		const bOver = b.slaMs - b.ageMs <= 0 ? 1 : 0;
		return bOver - aOver || RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.blastInstances - a.blastInstances || b.ageMs - a.ageMs;
	});

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
	const highBlast = isHighBlast(p);

	// Armed state for high-blast two-step confirm. View-local; resets on unmount
	// or after 3s of inactivity.
	const [armed, setArmed] = useState(false);
	const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearArmTimer = useCallback(() => {
		if (armTimerRef.current !== null) {
			clearTimeout(armTimerRef.current);
			armTimerRef.current = null;
		}
	}, []);

	// Disarm when the component unmounts or when a new `p.id` arrives (row recycled).
	useEffect(() => {
		return () => {
			clearArmTimer();
		};
	}, [clearArmTimer]);

	// Also disarm when the action id changes (e.g. the list re-sorts).
	useEffect(() => {
		setArmed(false);
		clearArmTimer();
	}, [p.id, clearArmTimer]);

	const handleApproveClick = useCallback(() => {
		if (!highBlast) {
			// Low-blast: single-click approve, unchanged behaviour.
			onApprove();
			return;
		}
		if (!armed) {
			// First click: arm the button and start the 3s disarm timer.
			setArmed(true);
			clearArmTimer();
			armTimerRef.current = setTimeout(() => {
				setArmed(false);
				armTimerRef.current = null;
			}, 3000);
		} else {
			// Second click while armed: confirm and fire.
			clearArmTimer();
			setArmed(false);
			onApprove();
		}
	}, [highBlast, armed, onApprove, clearArmTimer]);

	// Clicking elsewhere (Deny / Escalate) must also disarm.
	const handleDeny = useCallback(() => {
		clearArmTimer();
		setArmed(false);
		onDeny();
	}, [onDeny, clearArmTimer]);

	const handleEscalate = useCallback(() => {
		clearArmTimer();
		setArmed(false);
		onEscalate();
	}, [onEscalate, clearArmTimer]);

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
					{/* Approve — two-step for high-blast, single-click otherwise */}
					<button
						type="button"
						onClick={handleApproveClick}
						aria-label={armed ? `Confirm approve ${p.id}` : `Approve ${p.id}`}
						className={cn(
							"px-2.5 py-1 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]",
							armed
								? // Armed state: accent emphasis to signal intent, border only (no fill)
								  "border border-[var(--ret-accent)] text-[var(--ret-accent)] hover:bg-[var(--ret-accent)] hover:text-[var(--ret-bg)]"
								: // Normal state: solid accent fill (the primary action)
								  "border border-[var(--ret-accent)] bg-[var(--ret-accent)] text-[var(--ret-bg)] hover:brightness-110",
						)}
					>
						{armed ? "Confirm?" : "Approve"}
					</button>
					<button
						type="button"
						onClick={handleDeny}
						aria-label={`Deny ${p.id}`}
						className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
					>
						Deny
					</button>
					<button
						type="button"
						onClick={handleEscalate}
						aria-label={`Escalate ${p.id}`}
						className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
					>
						Escalate
					</button>
				</div>
			</div>
		</li>
	);
}
