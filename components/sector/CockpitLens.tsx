"use client";

import { cn } from "@/lib/cn";

import { IncidentLens } from "./IncidentLens";
import { QueueLens } from "./QueueLens";

// The COCKPIT lens: the 3am operator loop on one screen — what's on fire (left)
// beside what's awaiting your approval (right) — so triage and clear-the-queue
// stop spanning two tabs. Both panes are the same live projections of the shared
// store used by the standalone Incidents / Queue lenses; selection and counts
// stay coherent across all of them. Side-by-side on desktop, stacked on narrow.
export function CockpitLens({ className }: { className?: string }) {
	return (
		<div className={cn("flex h-full min-h-0 flex-col lg:flex-row", className)}>
			<section
				aria-label="Active incidents"
				className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-[var(--ret-border)] lg:border-b-0 lg:border-r"
			>
				<IncidentLens className="min-h-0 flex-1" />
			</section>
			<section aria-label="Approval queue" className="flex min-h-0 min-w-0 flex-1 flex-col">
				<QueueLens className="min-h-0 flex-1" />
			</section>
		</div>
	);
}
