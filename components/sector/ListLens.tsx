"use client";

import { useMemo, useState, useId, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { STATUS_RANK, type SreAgent } from "@/lib/sre-data";

import { AutonomyChip } from "./AutonomyChip";
import { HeartbeatDot } from "./HeartbeatDot";
import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// The calm 3am triage worklist and the keyboard/screen-reader spine of SECTOR.
// Sorted worst-first by SLO burn (default). Column headers are keyboard-operable
// sort buttons with aria-sort. A visually-hidden aria-live region announces the
// active sort. Dense table at md+, a stacked card list below md.

type SortKey =
	| "name"
	| "status"
	| "zone"
	| "service"
	| "autonomy"
	| "readiness"
	| "burn"
	| "eb"
	| "actions"
	| "cost"
	| "region"
	| "uptime";

type SortDir = "ascending" | "descending";

// Autonomy tier -> numeric rank for sorting
const AUTONOMY_RANK: Record<string, number> = {
	harnessed: 0,
	supervised: 1,
	guarded: 2,
	autonomous: 3,
};

function sortAgents(agents: SreAgent[], key: SortKey, dir: SortDir): SreAgent[] {
	const factor = dir === "ascending" ? 1 : -1;
	return [...agents].sort((a, b) => {
		let cmp = 0;
		switch (key) {
			case "name":
				cmp = a.name.localeCompare(b.name);
				break;
			case "status":
				// ascending = least-on-fire first; descending (default) = worst first
				cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
				break;
			case "zone":
				cmp = a.zone.localeCompare(b.zone);
				break;
			case "service":
				cmp = a.service.name.localeCompare(b.service.name);
				break;
			case "autonomy":
				cmp = AUTONOMY_RANK[a.autonomyTier] - AUTONOMY_RANK[b.autonomyTier];
				break;
			case "readiness":
				cmp = a.readiness - b.readiness;
				break;
			case "burn":
				cmp = a.slo.burnRate - b.slo.burnRate;
				break;
			case "eb":
				cmp = a.errorBudget.remainingPct - b.errorBudget.remainingPct;
				break;
			case "actions":
				cmp = a.actions.current - b.actions.current;
				break;
			case "cost":
				cmp = a.cost.current - b.cost.current;
				break;
			case "region":
				cmp = a.region.localeCompare(b.region);
				break;
			case "uptime":
				cmp = a.uptime.localeCompare(b.uptime);
				break;
		}
		// Secondary: worst-first by burn for stability
		if (cmp === 0) {
			cmp = STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.slo.burnRate - a.slo.burnRate;
		}
		return cmp * factor;
	});
}

// Human-readable sort announcement
function sortAnnouncement(key: SortKey, dir: SortDir): string {
	const labels: Record<SortKey, string> = {
		name: "agent name",
		status: "status / severity",
		zone: "zone",
		service: "owned service",
		autonomy: "autonomy tier",
		readiness: "readiness score",
		burn: "burn rate",
		eb: "error budget",
		actions: "actions per minute",
		cost: "cost per hour",
		region: "region",
		uptime: "uptime",
	};
	return `sorted by ${labels[key]}, ${dir}`;
}

// Sort glyph — ink/hairline only (not health color)
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
	if (!active) {
		return (
			<span aria-hidden className="ml-1 font-mono text-[9px] text-[var(--ret-text-muted)] opacity-40 select-none">
				⇅
			</span>
		);
	}
	return (
		<span aria-hidden className="ml-1 font-mono text-[9px] text-[var(--ret-text-dim)] select-none">
			{dir === "ascending" ? "↑" : "↓"}
		</span>
	);
}

export function ListLens({ className }: { className?: string }) {
	const { state, select, open } = useLens();
	const liveId = useId();

	// Default: "most-on-fire" order = status descending + burn descending (status key, descending)
	const [sortKey, setSortKey] = useState<SortKey>("status");
	const [sortDir, setSortDir] = useState<SortDir>("descending");

	const rows = useMemo(
		() => sortAgents(state.agents, sortKey, sortDir),
		[state.agents, sortKey, sortDir],
	);

	// Live announcement text (updated after sort)
	const [announcement, setAnnouncement] = useState<string>("");

	function handleSort(key: SortKey) {
		let nextDir: SortDir;
		if (key === sortKey) {
			nextDir = sortDir === "ascending" ? "descending" : "ascending";
		} else {
			// Default direction per column: numeric cols go descending (worst first); text cols ascending
			nextDir = (key === "name" || key === "zone" || key === "service" || key === "region" || key === "uptime" || key === "autonomy")
				? "ascending"
				: "descending";
		}
		setSortKey(key);
		setSortDir(nextDir);
		setAnnouncement(sortAnnouncement(key, nextDir));
	}

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
			{/* Visually-hidden aria-live region for sort announcements */}
			<div
				id={liveId}
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{announcement}
			</div>

			{/* mobile: stacked cards (below md) */}
			<ul className="divide-y divide-[var(--ret-border)] md:hidden">
				<li className="sr-only">Fleet agents. Press Enter on an item to open its dossier.</li>
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
									"group cursor-pointer px-3 py-3 outline-none transition-colors",
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
									<div className="flex shrink-0 items-center gap-2">
										{/* open affordance: shown on group hover/focus */}
										<span
											aria-hidden
											className="font-mono text-[10px] text-[var(--ret-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 select-none"
											title="Press Enter to open dossier"
										>
											↵
										</span>
										<span className="font-mono text-[11px] uppercase" style={{ color: STATUS_COLOR_VAR[a.status] }}>
											{a.status}
										</span>
									</div>
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
						Fleet agents. Press Enter on a row to open its dossier. Column headers are sortable.
					</caption>
					<thead className="sticky top-0 z-10 bg-[var(--ret-bg-soft)]">
						<tr className="border-b border-[var(--ret-border)] font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
							<SortTh col="name" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Agent</SortTh>
							<SortTh col="zone" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Zone</SortTh>
							<SortTh col="status" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Status</SortTh>
							<SortTh col="service" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Owns service</SortTh>
							<SortTh col="autonomy" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Autonomy</SortTh>
							<SortTh col="readiness" active={sortKey} dir={sortDir} onSort={handleSort} align="right">RDY</SortTh>
							<SortTh col="burn" active={sortKey} dir={sortDir} onSort={handleSort} align="right">Burn</SortTh>
							<SortTh col="eb" active={sortKey} dir={sortDir} onSort={handleSort} align="right">EB</SortTh>
							<SortTh col="actions" active={sortKey} dir={sortDir} onSort={handleSort} align="right">Actions</SortTh>
							<SortTh col="cost" active={sortKey} dir={sortDir} onSort={handleSort} align="right">$/hr</SortTh>
							<SortTh col="region" active={sortKey} dir={sortDir} onSort={handleSort} align="left">Region</SortTh>
							<SortTh col="uptime" active={sortKey} dir={sortDir} onSort={handleSort} align="right">Uptime</SortTh>
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
										"group cursor-pointer border-b border-[var(--ret-border)] outline-none transition-colors last:border-0",
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
									<td className="px-3 py-2">
										<div className="flex items-center justify-end gap-2">
											{/* open affordance: mono glyph, ink only, shown on row hover/focus */}
											<span
												aria-hidden
												className="font-mono text-[10px] text-[var(--ret-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 select-none"
												title="Enter to open dossier"
											>
												↵
											</span>
											<span className="font-mono text-[11px] text-[var(--ret-text-muted)]">{a.uptime}</span>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// SortTh — a <th> with an accessible sort button inside
// ---------------------------------------------------------------------------
type SortThProps = {
	col: SortKey;
	active: SortKey;
	dir: SortDir;
	onSort: (key: SortKey) => void;
	align: "left" | "right";
	children: React.ReactNode;
};

function SortTh({ col, active, dir, onSort, align, children }: SortThProps) {
	const isActive = active === col;
	const ariaSort: "ascending" | "descending" | "none" = isActive ? dir : "none";
	return (
		<th
			scope="col"
			aria-sort={ariaSort}
			className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}
		>
			<button
				type="button"
				onClick={() => onSort(col)}
				className={cn(
					"inline-flex items-center gap-0.5 font-mono text-[10px] uppercase transition-colors outline-none",
					"focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ret-bg-soft)]",
					align === "right" && "flex-row-reverse",
					isActive
						? "text-[var(--ret-text-dim)]"
						: "text-[var(--ret-text-muted)] hover:text-[var(--ret-text-dim)]",
				)}
			>
				{children}
				<SortIcon active={isActive} dir={dir} />
			</button>
		</th>
	);
}

// ---------------------------------------------------------------------------

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
