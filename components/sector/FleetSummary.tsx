"use client";

import { cn } from "@/lib/cn";
import { fleetOverview, type AgentStatus } from "@/lib/sre-data";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// Fleet rollup for the workspace header — a glanceable count by health.
export function FleetSummary({ className }: { className?: string }) {
	const { state } = useLens();
	const f = fleetOverview(state.agents);
	const items: [AgentStatus, number, string][] = [
		["critical", f.critical, "crit"],
		["degraded", f.degraded, "warn"],
		["healthy", f.healthy, "ok"],
		["idle", f.idle, "idle"],
	];
	return (
		<div className={cn("flex items-center gap-3 font-mono text-[11px]", className)}>
			{items.map(([status, n, label]) => (
				<span key={status} className="flex items-center gap-1.5 text-[var(--ret-text-dim)]">
					<span className="h-2 w-2" style={{ background: STATUS_COLOR_VAR[status] }} aria-hidden="true" />
					{n} {label}
				</span>
			))}
		</div>
	);
}
