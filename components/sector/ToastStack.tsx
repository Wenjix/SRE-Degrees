"use client";

import { useEffect, useRef } from "react";

import { useLens } from "./LensProvider";

// ToastStack — renders a single bottom-center undo toast when state.toast is set.
// Auto-dismisses after 6s. Square, hairline, ink-only chrome per design system.
export function ToastStack() {
	const { state, undoToast, dismissToast } = useLens();
	const toast = state.toast;
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Each new token restarts the 6s auto-dismiss timer.
	useEffect(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (toast !== null) {
			timerRef.current = setTimeout(() => {
				dismissToast();
				timerRef.current = null;
			}, 6000);
		}
		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [toast?.token]);

	if (!toast) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
		>
			<div className="ret-toast-in pointer-events-auto flex items-center gap-3 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-2.5 shadow-none">
				<span className="font-mono text-[11px] uppercase tracking-wide text-[var(--ret-text-dim)]">
					{toast.label}
				</span>
				{toast.restore !== null ? (
					<button
						type="button"
						onClick={undoToast}
						className="border border-[var(--ret-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
					>
						Undo
					</button>
				) : null}
				<button
					type="button"
					onClick={dismissToast}
					aria-label="Dismiss"
					className="border border-[var(--ret-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--ret-text-muted)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
				>
					×
				</button>
			</div>
		</div>
	);
}
