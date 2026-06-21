"use client";

import { useMemo } from "react";

import { Sparkline } from "@/components/dashboard/Sparkline";
import { cn } from "@/lib/cn";
import { SEVERITY_LABEL, severityTone, type Incident } from "@/lib/sre-data";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

const MIN = 60_000;
function dur(ms: number) {
	const m = Math.floor(ms / MIN);
	return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
const TREND_GLYPH = { worsening: "↑", stable: "→", recovering: "↓" } as const;

// The 3am view: what is on fire, since when, who/what is responding, and which
// way it's going. Severity drives the (health) color; clicking frames the agent.
export function IncidentLens({ className }: { className?: string }) {
	const { state, select, focusZone } = useLens();
	const incidents = useMemo(
		() => [...state.incidents].sort((a, b) => a.severity - b.severity || b.ageMs - a.ageMs),
		[state.incidents],
	);

	return (
		<div className={cn("h-full overflow-y-auto px-4 py-3", className)}>
			<div className="mb-2 flex items-center justify-between">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Active incidents</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{incidents.length}</span>
			</div>
			{incidents.length === 0 ? (
				<p className="border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-3 py-6 text-center font-mono text-[12px] text-[var(--ret-text-muted)]">
					No active incidents. The fleet is quiet.
				</p>
			) : (
				<ul className="space-y-2">
					{incidents.map((inc) => (
						<IncidentRow
							key={inc.id}
							inc={inc}
							responders={inc.agentIds.map((id) => state.agents.find((a) => a.id === id)?.name ?? id).join(", ")}
							onPick={() => {
								const a0 = inc.agentIds[0];
								if (a0) {
									select(a0);
									focusZone(state.agents.find((a) => a.id === a0)?.zone ?? null);
								}
							}}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function IncidentRow({ inc, responders, onPick }: { inc: Incident; responders: string; onPick: () => void }) {
	const color = STATUS_COLOR_VAR[severityTone(inc.severity)];
	return (
		<li>
			<button
				type="button"
				onClick={onPick}
				className="block w-full border border-[var(--ret-border)] bg-[var(--ret-bg)] p-3 text-left outline-none transition-colors hover:border-[var(--ret-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<span className="shrink-0 border px-1.5 py-0.5 font-mono text-[10px]" style={{ color, borderColor: color }}>
							{SEVERITY_LABEL[inc.severity]}
						</span>
						<span className="truncate text-[14px] font-semibold">{inc.title}</span>
					</div>
					<span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color }}>
						{dur(inc.ageMs)} {TREND_GLYPH[inc.trend]}
					</span>
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
					<span className="text-[var(--ret-text-muted)]">{inc.id}</span>
					<span>svc {inc.service}</span>
					<span className="uppercase">{inc.zones.join("/")}</span>
					{inc.customerImpact ? <span style={{ color: STATUS_COLOR_VAR.critical }}>customer-impacting</span> : null}
					<span>
						responders {responders}
						{inc.commander ? ` · IC ${inc.commander}` : " · IC unassigned"}
					</span>
				</div>
				<div className="mt-2 flex items-end justify-between gap-3">
					<div className="min-w-0">
						<div className="truncate font-mono text-[10px] text-[var(--ret-text-muted)]">{inc.trigger}</div>
						<div className="truncate font-mono text-[10px] text-[var(--ret-text-dim)]">↳ {inc.lastAction}</div>
					</div>
					<Sparkline values={inc.burnTrend} width={120} height={28} stroke={color} fill ariaLabel={`${inc.service} burn trend`} className="shrink-0" />
				</div>
			</button>
		</li>
	);
}
