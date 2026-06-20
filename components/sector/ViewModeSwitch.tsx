"use client";

import { LayoutGrid, Rocket, ScatterChart, Table2 } from "lucide-react";

import { cn } from "@/lib/cn";

import { useLens, type ViewMode } from "./LensProvider";

const VIEWS: { id: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
	{ id: "canvas", label: "Canvas", Icon: LayoutGrid },
	{ id: "list", label: "List", Icon: Table2 },
	{ id: "scatter", label: "Scatter", Icon: ScatterChart },
	{ id: "promote", label: "Promote", Icon: Rocket },
];

// Tab strip over the one shared store. Every lens is a live projection — switch
// freely, selection and data stay coherent.
export function ViewModeSwitch({ className }: { className?: string }) {
	const { state, setView } = useLens();
	return (
		<div className={cn("inline-flex border border-[var(--ret-border)]", className)} role="tablist" aria-label="View mode">
			{VIEWS.map(({ id, label, Icon }) => {
				const active = state.activeView === id;
				return (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => setView(id)}
						className={cn(
							"flex items-center gap-1.5 border-r border-[var(--ret-border)] px-2.5 py-1 font-mono text-[11px] transition-colors last:border-r-0",
							active
								? "bg-[var(--ret-accent)] text-[var(--ret-bg)]"
								: "text-[var(--ret-text-dim)] hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]",
						)}
					>
						<Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
						<span className="hidden sm:inline">{label}</span>
					</button>
				);
			})}
		</div>
	);
}
