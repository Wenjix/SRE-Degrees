"use client";

import { useEffect } from "react";

import { useLens, type Toast } from "./LensProvider";

// ToastStack — a bottom-center stack of undo toasts. The live-region wrapper is
// always mounted so additions are announced reliably; each toast owns its 6s
// auto-dismiss timer (start on mount, clear on unmount), so a rapid second
// action stacks a new toast instead of clobbering the first. Square, hairline,
// ink-only chrome per the design system.
export function ToastStack() {
	const { state } = useLens();
	return (
		<div
			role="status"
			aria-live="polite"
			aria-atomic="false"
			className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
		>
			{/* state keeps newest-first; render reversed so the newest sits at the bottom */}
			{[...state.toasts].reverse().map((t) => (
				<ToastItem key={t.token} toast={t} />
			))}
		</div>
	);
}

function ToastItem({ toast }: { toast: Toast }) {
	const { undoToast, dismissToast } = useLens();

	// Self-dismiss after 6s; the timer is tied to this toast's lifetime.
	useEffect(() => {
		const id = setTimeout(() => dismissToast(toast.token), 6000);
		return () => clearTimeout(id);
	}, [toast.token, dismissToast]);

	return (
		<div className="ret-toast-in pointer-events-auto flex items-center gap-3 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-2.5 shadow-none">
			<span className="font-mono text-[11px] uppercase tracking-wide text-[var(--ret-text-dim)]">{toast.label}</span>
			{toast.undo !== null ? (
				<button
					type="button"
					onClick={() => undoToast(toast.token)}
					className="border border-[var(--ret-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
				>
					Undo
				</button>
			) : null}
			<button
				type="button"
				onClick={() => dismissToast(toast.token)}
				aria-label="Dismiss"
				className="border border-[var(--ret-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--ret-text-muted)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
			>
				×
			</button>
		</div>
	);
}
