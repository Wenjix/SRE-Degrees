"use client";

import { useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { STATUS_RANK, type SreAgent } from "@/lib/sre-data";

import { AutonomyChip } from "./AutonomyChip";
import { HeartbeatDot } from "./HeartbeatDot";
import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// The calm 3am triage worklist and the keyboard/screen-reader spine of SECTOR.
// Sorted worst-first by SLO burn. A first-class projection of the same store.
// Dense table at md+, a stacked card list below md (the mobile-friendly surface).
export function ListLens({ className }: { className?: string }) {
	const { state, select, open } = useLens();
	const rows = useMemo(
		() =>
			[...state.agents].sort(
				(a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.slo.burnRate - a.slo.burnRate,
			),
		[state.agents],
	);

	const onItemKey = (e: ReactKeyboardEvent<HTMLElement>, agent: SreAgent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			open(agent.id);
		}
	};

	const label = (a: SreAgent) =>
		`${a.name}, ${a.status}, ${a.zone} zone, autonomy ${a.autonomyTier}, burn ${a.slo.burnRate.toFixed(1)}x. Enter to open dossier.`;

	return (
		<div className={cn("h-full overflow-auto", className)}>
			{/* mobile: stacked cards (below md) */}
			<ul className="divide-y divide-[var(--ret-border)] md:hidden">
				<li className="sr-only">Fleet agents sorted by SLO burn rate, worst first. Press Enter on an item to open its dossier.</li>
				{rows.map((a) => {
					const selected = state.selectedId === a.id;
					return (
						<li key={a.id}>
							<div
								role="button"
								tabIndex={0}
								aria-selected={selected}
								aria-label={label(a)}
								onClick={() => select(a.id)}
								onDoubleClick={() => open(a.id)}
								onKeyDown={(e) => onItemKey(e, a)}
								className={cn(
									"cursor-pointer px-3 py-3 outline-none transition-colors",
									"focus-visible:bg-[var(--ret-surface)]",
									selected ? "bg-[var(--ret-accent-glow)]" : "hover:bg-[var(--ret-surface)]",
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex min-w-0 items-center gap-2">
										<HeartbeatDot status={a.status} size={9} ring={false} />
										<div className="min-w-0">
											<div className="truncate text-[14px] font-semibold leading-tight">{a.name}</div>
											<div className="truncate font-mono text-[10px] text-[var(--ret-text-muted)]">
												{a.id} · {a.host}
											</div>
										</div>
									</div>
									<span className="shrink-0 font-mono text-[11px] uppercase" style={{ color: STATUS_COLOR_VAR[a.status] }}>
										{a.status}
									</span>
								</div>

								<div className="mt-2 flex items-center gap-2">
									<AutonomyChip tier={a.autonomyTier} compact />
									<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">
										RDY {a.autonomyTier === "autonomous" ? "—" : Math.round(a.readiness)}
									</span>
								</div>

								<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
									<Stat label="zone" value={a.zone.toUpperCase()} />
									<Stat label="burn" value={`${a.slo.burnRate.toFixed(1)}x`} />
									<Stat label="EB" value={`${a.errorBudget.remainingPct}%`} />
									<Stat label="actions" value={`${Math.round(a.actions.current)}/min`} />
									<Stat label="$/hr" value={`$${Math.round(a.cost.current)}`} />
									<Stat label="owns" value={`${a.service.name} ${a.service.burnRate > 1 ? `${a.service.burnRate.toFixed(1)}x` : `${a.service.errorBudgetPct}%`}`} />
									<Stat label="region" value={a.region} />
									<Stat label="uptime" value={a.uptime} />
								</dl>
							</div>
						</li>
					);
				})}
			</ul>

			{/* desktop: dense table (md+) */}
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full min-w-[1060px] border-collapse text-left">
					<caption className="sr-only">
						Fleet agents sorted by SLO burn rate, worst first. Press Enter on a row to open its dossier.
					</caption>
					<thead className="sticky top-0 z-10 bg-[var(--ret-bg-soft)]">
						<tr className="border-b border-[var(--ret-border)] font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
							<th scope="col" className="px-3 py-2 font-medium">Agent</th>
							<th scope="col" className="px-3 py-2 font-medium">Zone</th>
							<th scope="col" className="px-3 py-2 font-medium">Status</th>
							<th scope="col" className="px-3 py-2 font-medium">Owns service</th>
							<th scope="col" className="px-3 py-2 font-medium">Autonomy</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">RDY</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">Burn</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">EB</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">$/hr</th>
							<th scope="col" className="px-3 py-2 font-medium">Region</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">Uptime</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((a) => {
							const selected = state.selectedId === a.id;
							return (
								<tr
									key={a.id}
									tabIndex={0}
									aria-selected={selected}
									aria-label={label(a)}
									onClick={() => select(a.id)}
									onDoubleClick={() => open(a.id)}
									onKeyDown={(e) => onItemKey(e, a)}
									className={cn(
										"cursor-pointer border-b border-[var(--ret-border)] outline-none transition-colors last:border-0",
										"focus-visible:bg-[var(--ret-surface)]",
										selected ? "bg-[var(--ret-accent-glow)]" : "hover:bg-[var(--ret-surface)]",
									)}
								>
									<td className="px-3 py-2">
										<div className="flex items-center gap-2">
											<HeartbeatDot status={a.status} size={8} ring={false} />
											<div className="min-w-0">
												<div className="truncate text-[13px] font-semibold leading-tight">{a.name}</div>
												<div className="truncate font-mono text-[10px] text-[var(--ret-text-muted)]">
													{a.id} · {a.host}
												</div>
											</div>
										</div>
									</td>
									<td className="px-3 py-2 font-mono text-[11px] uppercase text-[var(--ret-text-dim)]">{a.zone}</td>
									<td className="px-3 py-2">
										<span className="font-mono text-[11px] uppercase" style={{ color: STATUS_COLOR_VAR[a.status] }}>
											{a.status}
										</span>
									</td>
									<td className="px-3 py-2 font-mono text-[11px]">
										<span className="text-[var(--ret-text-dim)]">{a.service.name}</span>
										<span className="ml-1.5 tabular-nums" style={{ color: svcColor(a.service) }}>
											{a.service.burnRate > 1 ? `${a.service.burnRate.toFixed(1)}x` : `${a.service.errorBudgetPct}%`}
										</span>
									</td>
									<td className="px-3 py-2">
										<AutonomyChip tier={a.autonomyTier} compact />
									</td>
									<td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">
										{a.autonomyTier === "autonomous" ? "—" : Math.round(a.readiness)}
									</td>
									<td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">{a.slo.burnRate.toFixed(1)}x</td>
									<td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">{a.errorBudget.remainingPct}%</td>
									<td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">{Math.round(a.actions.current)}</td>
									<td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums" style={a.cost.current >= 25 ? { color: STATUS_COLOR_VAR.critical } : undefined}>
										${Math.round(a.cost.current)}
									</td>
									<td className="px-3 py-2 font-mono text-[11px] text-[var(--ret-text-dim)]">{a.region}</td>
									<td className="px-3 py-2 text-right font-mono text-[11px] text-[var(--ret-text-muted)]">{a.uptime}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function svcColor(svc: { burnRate: number; errorBudgetPct: number }): string {
	if (svc.burnRate > 1) return STATUS_COLOR_VAR.critical;
	if (svc.errorBudgetPct < 30) return STATUS_COLOR_VAR.degraded;
	return STATUS_COLOR_VAR.healthy;
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-2 border-b border-[var(--ret-border)]/50 pb-0.5">
			<dt className="text-[9px] uppercase text-[var(--ret-text-muted)]">{label}</dt>
			<dd className="tabular-nums text-[var(--ret-text-dim)]">{value}</dd>
		</div>
	);
}
