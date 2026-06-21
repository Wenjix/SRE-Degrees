"use client";

import { memo } from "react";
import { Maximize2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { ReticleFrame } from "@/components/reticle";
import type { SreAgent } from "@/lib/sre-data";

import { AutonomyChip } from "./AutonomyChip";
import { ErrorBudgetArc } from "./ErrorBudgetArc";
import { HealthSpine } from "./HealthSpine";
import { HeartbeatDot } from "./HeartbeatDot";
import { TerminalTail } from "./TerminalTail";
import { ToolsRail } from "./ToolsRail";
import { STATUS_COLOR_VAR } from "./visual";

export type CardLevel = "L1" | "L2";

// Presentational. Positioning, selection events and keyboard live on the canvas
// wrapper; this renders one agent at the requested density. Fills its parent.
function AgentCardImpl({
	agent,
	level,
	selected = false,
}: {
	agent: SreAgent;
	level: CardLevel;
	selected?: boolean;
}) {
	const color = STATUS_COLOR_VAR[agent.status];
	const svcColor = serviceColorFor(agent.service);
	const runaway = agent.cost.current >= 25;

	if (level === "L1") {
		return (
			<ReticleFrame
				corners={false}
				className={cn(
					"ret-agent relative h-full w-full overflow-hidden bg-[var(--ret-bg)] pl-2.5 pr-2 py-2",
					selected && "ring-1 ring-[var(--ret-border-strong)]",
				)}
				style={selected ? { boxShadow: "0 0 0 1px var(--ret-border-strong)" } : undefined}
			>
				<HealthSpine status={agent.status} burnRate={agent.slo.burnRate} />
				<div className="flex items-center gap-1.5">
					<HeartbeatDot status={agent.status} size={9} />
					<span className="truncate text-[12px] font-semibold leading-tight">{agent.name}</span>
				</div>
				<div className="mt-0.5 truncate font-mono text-[9px] text-[var(--ret-text-muted)]">{agent.id}</div>
				<div className="mt-1.5">
					<Sparkline
						values={agent.actions.series.slice(-12)}
						width={120}
						height={16}
						stroke={color}
						fill
						ariaLabel={`${agent.name} actions/min trend`}
						className="w-full"
					/>
				</div>
				<div className="mt-1 space-y-0.5">
					{agent.terminalLines.slice(-2).map((line, i) => (
						<div key={i} className="truncate font-mono text-[9px] text-[var(--ret-text-dim)]">
							{line}
						</div>
					))}
				</div>

				{/* open-dossier affordance — ink corner tag, visible on hover or when selected.
				    aria-hidden: the aria-label on the canvas wrapper already says "Enter to open dossier". */}
				<span
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute right-0 top-0 flex items-center justify-center border-b border-l border-[var(--ret-border)] bg-[var(--ret-bg)] p-0.5",
						"opacity-0 transition-opacity duration-0",
						"group-hover:opacity-100",
						selected && "opacity-100",
					)}
				>
					<Maximize2 size={9} strokeWidth={1.75} className="text-[var(--ret-text-muted)]" />
				</span>
			</ReticleFrame>
		);
	}

	// L2 — full Dedalus fidelity
	return (
		<ReticleFrame
			corners={selected}
			className={cn(
				"ret-agent relative h-full w-full overflow-hidden bg-[var(--ret-bg)] py-2.5 pl-3 pr-9",
				selected && "z-10",
			)}
			style={
				selected
					? { boxShadow: `0 0 0 1px var(--ret-border-strong), 0 10px 30px var(--ret-accent-glow)` }
					: undefined
			}
		>
			<HealthSpine status={agent.status} burnRate={agent.slo.burnRate} />
			{selected ? <span className="absolute inset-x-0 top-0 block h-[2px]" style={{ background: color }} /> : null}

			<div className="flex h-full flex-col">
				{/* header */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<HeartbeatDot status={agent.status} size={8} />
						<span className="truncate font-mono text-[10px] text-[var(--ret-text-dim)]">{agent.id}</span>
					</div>
					<ErrorBudgetArc remainingPct={agent.errorBudget.remainingPct} status={agent.status} size={28} />
				</div>

				{/* identity */}
				<div className="mt-1 min-w-0">
					<div className="ret-display truncate text-[14px]">{agent.name}</div>
					<div className="truncate font-mono text-[10px] text-[var(--ret-text-dim)]">
						{agent.host} · {agent.org}
					</div>
				</div>

				{/* status line — the AGENT's own reliability + cost (never color-only) */}
				<div className="mt-1 flex items-center gap-1.5 truncate font-mono text-[10px]">
					<span style={{ color }} className="uppercase">
						{agent.status}
					</span>
					<span className="truncate text-[var(--ret-text-muted)]">
						· burn {agent.slo.burnRate.toFixed(1)}x · EB {agent.errorBudget.remainingPct}%
					</span>
					<span
						className="ml-auto shrink-0 tabular-nums"
						style={{ color: runaway ? STATUS_COLOR_VAR.critical : "var(--ret-text-dim)" }}
						title={runaway ? "runaway cost" : "spend"}
					>
						${Math.round(agent.cost.current)}/hr
					</span>
				</div>

				{/* the SERVICE this agent owns — its budget is independent of agent health */}
				<div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px]">
					<span className="shrink-0 text-[var(--ret-text-muted)]">owns</span>
					<span className="truncate text-[var(--ret-text-dim)]">{agent.service.name}</span>
					<span className="ml-auto shrink-0 tabular-nums" style={{ color: svcColor }}>
						{agent.service.burnRate > 1 ? `burn ${agent.service.burnRate.toFixed(1)}x` : `EB ${agent.service.errorBudgetPct}%`}
					</span>
				</div>

				<div className="my-2 h-px bg-[var(--ret-border)]" />

				{/* stat strip */}
				<div className="grid grid-cols-3 gap-2">
					<Stat label="ACTIONS" value={`${Math.round(agent.actions.current)}`} unit={agent.actions.unit} series={agent.actions.series} color={color} />
					<Stat label="TOOL OK" value={`${agent.toolSuccess.current.toFixed(1)}`} unit="%" series={agent.toolSuccess.series} color={color} />
					<Stat label="DEC p95" value={`${Math.round(agent.decisionMs.current)}`} unit="ms" series={agent.decisionMs.series} color={color} />
				</div>

				{/* terminal tail */}
				<TerminalTail lines={agent.terminalLines} maxLines={4} className="mt-2 min-h-0 flex-1" />

				{/* footer */}
				<div className="mt-2 space-y-1">
					<AutonomyChip
						tier={agent.autonomyTier}
						readiness={agent.autonomyTier === "autonomous" ? undefined : agent.readiness}
						compact
						className="w-full"
					/>
					<div className="flex items-center justify-between gap-2">
						<span className="border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--ret-text-dim)]">
							{agent.region}
						</span>
						<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{agent.uptime}</span>
					</div>
				</div>
			</div>

			{/* tools rail on the right edge */}
			<ToolsRail tools={agent.tools} className="absolute right-1.5 top-2.5" />

			{/* open-dossier affordance — ink corner tag, visible on hover or when selected.
			    Positioned at the top-right corner (above the tools rail which starts at top-2.5).
			    aria-hidden: the aria-label on the canvas wrapper already says "Enter to open dossier". */}
			<span
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute right-0 top-0 flex items-center justify-center border-b border-l border-[var(--ret-border)] bg-[var(--ret-bg)] p-0.5",
					"opacity-0 transition-opacity duration-0",
					"group-hover:opacity-100",
					selected && "opacity-100",
				)}
			>
				<Maximize2 size={10} strokeWidth={1.75} className="text-[var(--ret-text-muted)]" />
			</span>
		</ReticleFrame>
	);
}

// Memoized: skips re-render when the agent reference is unchanged (idle agents
// are frozen in stepTelemetry, so their cards stop re-rendering every TICK).
export const AgentCard = memo(AgentCardImpl);

// The owned SERVICE's health (its own burn/budget), distinct from agent health.
function serviceColorFor(svc: SreAgent["service"]): string {
	if (svc.burnRate > 1) return STATUS_COLOR_VAR.critical;
	if (svc.errorBudgetPct < 30) return STATUS_COLOR_VAR.degraded;
	return STATUS_COLOR_VAR.healthy;
}

function Stat({
	label,
	value,
	unit,
	series,
	color,
}: {
	label: string;
	value: string;
	unit: string;
	series: number[];
	color: string;
}) {
	return (
		<div className="min-w-0">
			<div className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">{label}</div>
			<div className="truncate font-mono text-[11px] tabular-nums text-[var(--ret-text)]">
				{value}
				<span className="ml-0.5 text-[8px] text-[var(--ret-text-muted)]">{unit}</span>
			</div>
			<Sparkline values={series.slice(-12)} width={72} height={12} stroke={color} ariaLabel={`${label} trend`} className="mt-0.5 w-full" />
		</div>
	);
}
