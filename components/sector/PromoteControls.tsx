"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { blockingReason, eligible, nextTier } from "@/lib/promotion";
import type { SreAgent } from "@/lib/sre-data";

// HITL ritual. Promote is disabled until eligible() (tooltip names the blocker).
// The final step to AUTONOMOUS is a deliberate press-and-hold "REMOVE OVERSIGHT"
// (Space-hold via keyboard; reduced-motion degrades to a two-step confirm).
const HOLD_MS = 1200;

function prefersReducedMotion() {
	if (typeof window === "undefined") return false;
	return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function PromoteControls({
	agent,
	onPromote,
	onHold,
	onRollback,
}: {
	agent: SreAgent;
	onPromote: () => void;
	onHold: () => void;
	onRollback: () => void;
}) {
	const to = nextTier(agent.autonomyTier);
	const ok = eligible(agent);
	const reason = blockingReason(agent);
	const isFinal = to === "autonomous";
	const reasonId = `promote-block-${agent.id}`;

	const [holding, setHolding] = useState(false);
	const [confirmArmed, setConfirmArmed] = useState(false);
	const timer = useRef<number | null>(null);
	const reduced = prefersReducedMotion();

	// reset transient hold state when the candidate changes
	useEffect(() => {
		setHolding(false);
		setConfirmArmed(false);
		if (timer.current) window.clearTimeout(timer.current);
	}, [agent.id, agent.autonomyTier]);

	const startHold = () => {
		if (!ok) return;
		if (reduced) {
			setConfirmArmed(true);
			return;
		}
		setHolding(true);
		timer.current = window.setTimeout(() => {
			setHolding(false);
			onPromote();
		}, HOLD_MS);
	};
	const cancelHold = () => {
		setHolding(false);
		if (timer.current) window.clearTimeout(timer.current);
	};

	return (
		<div className="flex items-center gap-2">
			{!ok && reason ? (
				<span id={reasonId} className="sr-only">
					Promotion blocked: {reason}
				</span>
			) : null}
			<button
				type="button"
				onClick={onRollback}
				disabled={agent.autonomyTier === "harnessed"}
				className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors enabled:hover:text-[var(--ret-text)] disabled:opacity-40"
			>
				Roll back
			</button>
			<button
				type="button"
				onClick={onHold}
				className="border border-[var(--ret-border)] px-2 py-1 font-mono text-[11px] text-[var(--ret-text-dim)] transition-colors hover:text-[var(--ret-text)]"
			>
				Hold
			</button>

			{isFinal ? (
				confirmArmed ? (
					<button
						type="button"
						onClick={onPromote}
						className="border border-[var(--ret-red)] bg-[var(--ret-red)]/15 px-3 py-1 font-mono text-[11px] text-[var(--ret-red)]"
					>
						Confirm — remove oversight
					</button>
				) : (
					<button
						type="button"
						aria-disabled={!ok}
						aria-describedby={!ok ? reasonId : undefined}
						title={ok ? "Press and hold to remove all human oversight" : (reason ?? "")}
						onPointerDown={startHold}
						onPointerUp={cancelHold}
						onPointerLeave={cancelHold}
						onKeyDown={(e) => {
							if (e.key === " " || e.key === "Enter") {
								e.preventDefault();
								startHold();
							}
						}}
						onKeyUp={(e) => {
							if (e.key === " " || e.key === "Enter") cancelHold();
						}}
						className={cn(
							"relative overflow-hidden border px-3 py-1 font-mono text-[11px] transition-colors",
							ok
								? "border-[var(--ret-accent)] text-[var(--ret-text)]"
								: "border-[var(--ret-border)] text-[var(--ret-text-muted)] opacity-50",
						)}
					>
						<span
							className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-[var(--ret-accent)]/25 transition-transform ease-linear"
							style={{ transform: holding ? "scaleX(1)" : "scaleX(0)", transitionDuration: holding ? `${HOLD_MS}ms` : "120ms" }}
							aria-hidden="true"
						/>
						<span className="relative">⌷ hold: remove oversight</span>
					</button>
				)
			) : (
				<button
					type="button"
					onClick={() => {
						if (ok) onPromote();
					}}
					aria-disabled={!ok}
					aria-describedby={!ok ? reasonId : undefined}
					title={ok ? "Promote one tier" : (reason ?? "")}
					className={cn(
						"border px-3 py-1 font-mono text-[11px] transition-colors",
						ok
							? "border-[var(--ret-accent)] bg-[var(--ret-accent)] text-[var(--ret-bg)] hover:brightness-110"
							: "border-[var(--ret-border)] text-[var(--ret-text-muted)] opacity-50",
					)}
				>
					Promote
				</button>
			)}
		</div>
	);
}
