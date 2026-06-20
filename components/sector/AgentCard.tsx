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
export function AgentCard({
	agent,
	level,
	selected = false,
}: {
	agent: SreAgent;
	level: CardLevel;
	selected?: boolean;
}) {
	const color = STATUS_COLOR_VAR[agent.status];

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
						values={agent.cpu.series.slice(-12)}
						width={120}
						height={16}
						stroke={color}
						fill
						ariaLabel={`${agent.name} cpu trend`}
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

				{/* status line — textual status so health is never color-only */}
				<div className="mt-1 truncate font-mono text-[10px]">
					<span style={{ color }} className="uppercase">
						{agent.status}
					</span>
					<span className="text-[var(--ret-text-muted)]">
						{" · "}burn {agent.slo.burnRate.toFixed(1)}x · EB {agent.errorBudget.remainingPct}%
					</span>
				</div>

				<div className="my-2 h-px bg-[var(--ret-border)]" />

				{/* stat strip */}
				<div className="grid grid-cols-3 gap-2">
					<Stat label="CPU" value={`${agent.cpu.current.toFixed(2)}`} unit={agent.cpu.unit} series={agent.cpu.series} color={color} />
					<Stat label="MEM" value={`${Math.round(agent.mem.current)}`} unit={agent.mem.unit} series={agent.mem.series} color={color} />
					<Stat label="DISK" value={`${agent.disk.current.toFixed(1)}`} unit={agent.disk.unit} series={agent.disk.series} color={color} />
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
		</ReticleFrame>
	);
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
