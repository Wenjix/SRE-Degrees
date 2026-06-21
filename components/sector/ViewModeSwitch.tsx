"use client";

import { AlertTriangle, Globe, Inbox, LayoutGrid, Rocket, ScatterChart, Share2, Table2, Telescope } from "lucide-react";

import { cn } from "@/lib/cn";

import { useLens, type ViewMode } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

const VIEWS: { id: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
	{ id: "canvas", label: "Canvas", Icon: LayoutGrid },
	{ id: "list", label: "List", Icon: Table2 },
	{ id: "scatter", label: "Scatter", Icon: ScatterChart },
	{ id: "promote", label: "Promote", Icon: Rocket },
	{ id: "incidents", label: "Incidents", Icon: AlertTriangle },
	{ id: "queue", label: "Queue", Icon: Inbox },
	{ id: "fleet", label: "Fleet", Icon: Telescope },
	{ id: "blast", label: "Map", Icon: Share2 },
	{ id: "world", label: "World", Icon: Globe },
];

// Tab strip over the one shared store. Every lens is a live projection — switch
// freely, selection and data stay coherent.
export function ViewModeSwitch({ className }: { className?: string }) {
	const { state, setView } = useLens();
	const sevOpen = state.incidents.some((i) => i.severity <= 2);
	const overdue = state.pendingActions.some((p) => p.slaMs - p.ageMs <= 0);
	const badgeFor = (id: ViewMode): { n: number; urgent: boolean } | null => {
		if (id === "incidents" && state.incidents.length) return { n: state.incidents.length, urgent: sevOpen };
		if (id === "queue" && state.pendingActions.length) return { n: state.pendingActions.length, urgent: overdue };
		return null;
	};

	return (
		<div className={cn("inline-flex border border-[var(--ret-border)]", className)} role="tablist" aria-label="View mode">
			{VIEWS.map(({ id, label, Icon }) => {
				const active = state.activeView === id;
				const badge = badgeFor(id);
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
						{badge ? (
							<span
								className={cn("ml-0.5 min-w-[14px] px-1 text-center text-[9px] tabular-nums", active ? "bg-[var(--ret-bg)]/25" : "")}
								style={badge.urgent && !active ? { color: STATUS_COLOR_VAR.critical } : undefined}
							>
								{badge.n}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
