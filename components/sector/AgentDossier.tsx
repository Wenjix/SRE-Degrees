"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Sparkline } from "@/components/dashboard/Sparkline";
import { cn } from "@/lib/cn";
import { blockingReason, eligible, GATES, nextTier, TIER_MEANING } from "@/lib/promotion";

import { AutonomyChip } from "./AutonomyChip";
import { ErrorBudgetArc } from "./ErrorBudgetArc";
import { HeartbeatDot } from "./HeartbeatDot";
import { useLens } from "./LensProvider";
import { ProvingStepper } from "./ProvingStepper";
import { TerminalTail } from "./TerminalTail";
import { STATUS_COLOR_VAR, TOOL_ICON } from "./visual";

// L3 — the full agent dossier. Opens on Enter / double-click. The rest of the
// board dims behind it (depth-of-field). Esc or backdrop closes.
export function AgentDossier() {
	const { state, close } = useLens();
	const openId = state.openAgentId;
	const agent = useMemo(
		() => state.agents.find((a) => a.id === state.openAgentId) ?? null,
		[state.agents, state.openAgentId],
	);
	const asideRef = useRef<HTMLElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	const restoreRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!openId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [openId, close]);

	// Modal focus management (WCAG 2.4.3 / 2.1.2): capture the trigger, move focus
	// into the dialog, restore focus to the trigger on close.
	useEffect(() => {
		if (!openId) return;
		restoreRef.current = (document.activeElement as HTMLElement) ?? null;
		const raf = window.requestAnimationFrame(() => closeRef.current?.focus());
		return () => {
			window.cancelAnimationFrame(raf);
			restoreRef.current?.focus?.();
		};
	}, [openId]);

	if (!agent) return null;
	const color = STATUS_COLOR_VAR[agent.status];
	const deps = state.agents.filter((a) => agent.dependsOn.includes(a.id));

	// Trap Tab within the dialog (cycle first <-> last focusable).
	const onTrap = (e: ReactKeyboardEvent<HTMLElement>) => {
		if (e.key !== "Tab") return;
		const root = asideRef.current;
		if (!root) return;
		const nodes = root.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		const list = Array.from(nodes).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
		if (list.length === 0) return;
		const first = list[0];
		const last = list[list.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	};

	return (
		<div className="fixed inset-0 z-[70]">
			<div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={close} aria-hidden="true" />
			<aside
				ref={asideRef}
				role="dialog"
				aria-modal="true"
				aria-label={`${agent.name} dossier`}
				tabIndex={-1}
				onKeyDown={onTrap}
				className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-[var(--ret-border)] bg-[var(--ret-bg)] shadow-[-24px_0_80px_rgba(0,0,0,0.4)] focus:outline-none"
			>
				{/* header */}
				<div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
					<div className="flex min-w-0 items-start gap-2.5">
						<HeartbeatDot status={agent.status} size={10} />
						<div className="min-w-0">
							<div className="ret-display truncate text-[16px]">{agent.name}</div>
							<div className="truncate font-mono text-[10px] text-[var(--ret-text-dim)]">
								{agent.id} · {agent.host} · {agent.org}
							</div>
						</div>
					</div>
					<button
						ref={closeRef}
						type="button"
						onClick={close}
						aria-label="Close dossier"
						className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--ret-border)] text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]"
					>
						<X className="h-3.5 w-3.5" strokeWidth={1.75} />
					</button>
				</div>

				<div className="space-y-4 p-4">
					{/* status + budget */}
					<div className="flex items-center justify-between gap-3 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] p-3">
						<div className="font-mono text-[11px]">
							<div className="uppercase" style={{ color }}>
								{agent.status}
							</div>
							<div className="mt-1 text-[var(--ret-text-dim)]">
								SLO {agent.slo.target}% · burn {agent.slo.burnRate.toFixed(1)}x
							</div>
							<div className="text-[var(--ret-text-dim)]">
								{agent.region} · {agent.uptime}
							</div>
						</div>
						<div className="flex flex-col items-center gap-1">
							<ErrorBudgetArc remainingPct={agent.errorBudget.remainingPct} status={agent.status} size={48} />
							<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">EB {agent.errorBudget.remainingPct}%</span>
						</div>
					</div>

					{/* autonomy / promotion */}
					<Section title="Autonomy">
						<div className="flex flex-wrap items-center gap-2">
							<AutonomyChip
								tier={agent.autonomyTier}
								readiness={agent.autonomyTier === "autonomous" ? undefined : agent.readiness}
							/>
							<span className="font-mono text-[10px] text-[var(--ret-text-dim)]">{TIER_MEANING[agent.autonomyTier]}</span>
						</div>
						{nextTier(agent.autonomyTier) ? (
							<>
								<ProvingStepper current={agent.provingEnv} required={GATES[agent.autonomyTier].requiredEnv} className="mt-2" />
								<p className="mt-1.5 font-mono text-[10px] text-[var(--ret-text-muted)]">
									{eligible(agent) ? "eligible to promote — switch to PROMOTE to advance" : `blocked: ${blockingReason(agent)}`}
								</p>
							</>
						) : (
							<p className="mt-1.5 font-mono text-[10px] text-[var(--ret-text-muted)]">operating with no human oversight</p>
						)}
					</Section>

					{/* metrics — 1h trend */}
					<Section title="Resources · last hour">
						<div className="space-y-2.5">
							<MetricRow label="CPU" value={`${agent.cpu.current.toFixed(2)} ${agent.cpu.unit}`} series={agent.cpu.series} color={color} />
							<MetricRow label="MEM" value={`${Math.round(agent.mem.current)} ${agent.mem.unit}`} series={agent.mem.series} color={color} />
							<MetricRow label="DISK" value={`${agent.disk.current.toFixed(1)} ${agent.disk.unit}`} series={agent.disk.series} color={color} />
						</div>
					</Section>

					{/* tools */}
					<Section title="Bound tools">
						<div className="flex flex-wrap gap-1.5">
							{agent.tools.map((t) => {
								const Icon = TOOL_ICON[t.icon];
								return (
									<span
										key={t.id}
										className={cn(
											"inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px]",
											t.active
												? "border-[var(--ret-accent)] text-[var(--ret-text)]"
												: "border-[var(--ret-border)] text-[var(--ret-text-dim)]",
										)}
									>
										<Icon className="h-3 w-3" strokeWidth={1.75} />
										{t.label}
									</span>
								);
							})}
						</div>
					</Section>

					{/* mcp + cron + deps */}
					<div className="grid grid-cols-2 gap-3">
						<Section title="MCP servers">
							<ul className="space-y-1 font-mono text-[11px] text-[var(--ret-text-dim)]">
								{agent.mcpServers.map((s) => (
									<li key={s}>· {s}</li>
								))}
							</ul>
						</Section>
						<Section title="Cron">
							<ul className="space-y-1 font-mono text-[11px] text-[var(--ret-text-dim)]">
								{agent.cron.map((c) => (
									<li key={c.label}>
										{c.label} <span className="text-[var(--ret-text-muted)]">{c.etaMin}m</span>
									</li>
								))}
							</ul>
						</Section>
					</div>

					{deps.length > 0 ? (
						<Section title="Depends on">
							<div className="flex flex-wrap gap-1.5">
								{deps.map((d) => (
									<span key={d.id} className="inline-flex items-center gap-1.5 border border-[var(--ret-border)] px-2 py-0.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
										<span className="h-1.5 w-1.5" style={{ background: STATUS_COLOR_VAR[d.status] }} aria-hidden="true" />
										{d.name}
									</span>
								))}
							</div>
						</Section>
					) : null}

					{/* full tail */}
					<Section title="Live tail">
						<TerminalTail lines={agent.terminalLines} maxLines={agent.terminalLines.length} className="max-h-48 overflow-y-auto" />
					</Section>
				</div>
			</aside>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">{title}</div>
			{children}
		</div>
	);
}

function MetricRow({ label, value, series, color }: { label: string; value: string; series: number[]; color: string }) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-10 shrink-0 font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">{label}</span>
			<Sparkline values={series} width={220} height={28} stroke={color} fill ariaLabel={`${label} last hour`} className="min-w-0 flex-1" />
			<span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--ret-text)]">{value}</span>
		</div>
	);
}
