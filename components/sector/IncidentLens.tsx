"use client";

import { useCallback, useRef, useState } from "react";

import { Sparkline } from "@/components/dashboard/Sparkline";
import { cn } from "@/lib/cn";
import { incidentRunStages, type StageStatus } from "@/lib/policy-trace";
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
	const { state } = useLens();
	// Last announced action for the aria-live region
	const [liveMsg, setLiveMsg] = useState("");
	const incidents = [...state.incidents].sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.severity - b.severity || b.ageMs - a.ageMs);
	const activeCount = incidents.filter((i) => !i.resolved).length;

	return (
		<div className={cn("h-full overflow-y-auto px-4 py-3", className)}>
			{/* visually-hidden aria-live region for action announcements */}
			<div
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{liveMsg}
			</div>
			<div className="mb-2 flex items-center justify-between">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Active incidents</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{activeCount}</span>
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
							firstAgentId={inc.agentIds[0] ?? null}
							firstAgentZone={inc.agentIds[0] ? (state.agents.find((a) => a.id === inc.agentIds[0])?.zone ?? null) : null}
							onAnnounce={setLiveMsg}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function IncidentRow({
	inc,
	responders,
	firstAgentId,
	firstAgentZone,
	onAnnounce,
}: {
	inc: Incident;
	responders: string;
	firstAgentId: string | null;
	firstAgentZone: import("@/lib/sre-data").Tier | null;
	onAnnounce: (msg: string) => void;
}) {
	const { acknowledgeIncident, assignCommander, resolveIncident, open, setView, select, focusZone } = useLens();
	const color = STATUS_COLOR_VAR[severityTone(inc.severity)];
	const headerRef = useRef<HTMLButtonElement>(null);

	const handleAck = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			acknowledgeIncident(inc.id);
			onAnnounce(`${inc.id} acknowledged`);
			headerRef.current?.focus(); // keep keyboard/SR focus on the row when the button unmounts
		},
		[acknowledgeIncident, inc.id, onAnnounce],
	);

	const handleAssign = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			assignCommander(inc.id);
			onAnnounce(`IC assigned to ${inc.id}`);
			headerRef.current?.focus(); // keep keyboard/SR focus on the row when the button unmounts
		},
		[assignCommander, inc.id, onAnnounce],
	);

	const handleOpen = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (firstAgentId) open(firstAgentId);
		},
		[open, firstAgentId],
	);

	const handleMap = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (firstAgentId) {
				setView("blast");
				select(firstAgentId);
			}
		},
		[setView, select, firstAgentId],
	);

	const handleResolve = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			resolveIncident(inc.id);
			onAnnounce(`${inc.id} resolved — fire out`);
			headerRef.current?.focus(); // keep keyboard/SR focus on the row when the button unmounts
		},
		[resolveIncident, inc.id, onAnnounce],
	);

	const handleRowClick = useCallback(() => {
		if (firstAgentId) {
			select(firstAgentId);
			focusZone(firstAgentZone);
		}
	}, [select, focusZone, firstAgentId, firstAgentZone]);
	const stages = incidentRunStages(inc);

	// Ghost button base — square, 1px hairline, mono label, ghost style
	const ghostBtn =
		"border border-[var(--ret-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]";

	return (
		<li
			className={cn(
				"border border-[var(--ret-border)] bg-[var(--ret-bg)] transition-colors hover:border-[var(--ret-border-hover)]",
				inc.resolved ? "opacity-50" : inc.acknowledged ? "opacity-70" : null,
			)}
		>
			{/* row header — selectable, maps the agent on the canvas */}
			<button
				type="button"
				ref={headerRef}
				onClick={handleRowClick}
				className="block w-full p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
			>
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<span
							className="shrink-0 border px-1.5 py-0.5 font-mono text-[10px]"
							style={inc.severity === 1 ? { backgroundColor: color, borderColor: color, color: "var(--ret-bg)" } : { color, borderColor: color }}
						>
							{SEVERITY_LABEL[inc.severity]}
						</span>
						<span className="truncate text-[14px] font-semibold">{inc.title}</span>
						{inc.acknowledged && !inc.resolved ? (
							<span className="shrink-0 border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ret-text-muted)]">
								ACK
							</span>
						) : null}
						{inc.resolved ? (
							<span className="shrink-0 border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--ret-text-muted)]">
								RESOLVED
							</span>
						) : null}
					</div>
					<span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color }}>
						{dur(inc.ageMs)} {TREND_GLYPH[inc.trend]}
					</span>
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
					<span className="text-[var(--ret-text-muted)]">{inc.id}</span>
					<span>svc {inc.service}</span>
					<span className="uppercase">{inc.zones.join("/")}</span>
					{inc.customerImpact ? (
						<span style={{ color: STATUS_COLOR_VAR.critical }}>customer-impacting</span>
					) : null}
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
					<Sparkline
						values={inc.burnTrend}
						width={120}
						height={28}
						stroke={color}
						fill
						ariaLabel={`${inc.service} burn trend`}
						className="shrink-0"
					/>
				</div>
				<div className="mt-2 grid grid-cols-3 gap-1.5">
					{stages.map((s) => (
						<RunStage key={s.id} label={s.label} status={s.status} detail={s.detail} />
					))}
				</div>
			</button>

			{/* action cluster — square ghost buttons; replaced by a note once resolved */}
			{inc.resolved ? (
				<div className="border-t border-[var(--ret-border)] px-3 py-2 font-mono text-[10px] text-[var(--ret-text-muted)]">
					resolved — {inc.service} within budget · recovery logged as proving evidence
				</div>
			) : (
				<div className="flex items-center gap-1.5 border-t border-[var(--ret-border)] px-3 py-2">
					{/* Ack — hidden once acknowledged */}
					{!inc.acknowledged ? (
						<button type="button" onClick={handleAck} className={ghostBtn} aria-label={`Acknowledge ${inc.id}`}>
							Ack
						</button>
					) : null}

					{/* Assign IC — only when commander is null */}
					{inc.commander === null ? (
						<button type="button" onClick={handleAssign} className={ghostBtn} aria-label={`Assign incident commander to ${inc.id}`}>
							Assign IC
						</button>
					) : null}

					{/* Open dossier */}
					{firstAgentId ? (
						<button type="button" onClick={handleOpen} className={ghostBtn} aria-label={`Open dossier for ${inc.id}`}>
							Open
						</button>
					) : null}

					{/* Map — blast view */}
					{firstAgentId ? (
						<button type="button" onClick={handleMap} className={ghostBtn} aria-label={`Map blast radius for ${inc.id}`}>
							Map
						</button>
					) : null}

					{/* Resolve — fire out: recovery becomes promotion evidence */}
					{firstAgentId ? (
						<button type="button" onClick={handleResolve} className={ghostBtn} aria-label={`Resolve ${inc.id}`}>
							Resolve
						</button>
					) : null}
				</div>
			)}
		</li>
	);
}

function RunStage({ label, status, detail }: { label: string; status: StageStatus; detail: string }) {
	return (
		<div className="min-w-0 border border-[var(--ret-border)]/70 bg-[var(--ret-bg-soft)] px-2 py-1 text-left font-mono">
			<div className="flex items-center justify-between gap-1">
				<span className="truncate text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">{label}</span>
				<span className={cn("text-[9px] uppercase", stageTone(status))}>{status}</span>
			</div>
			<div className="mt-0.5 truncate text-[9px] text-[var(--ret-text-dim)]">{detail}</div>
		</div>
	);
}

function stageTone(status: StageStatus): string {
	if (status === "done") return "text-[var(--ret-accent)]";
	if (status === "active") return "text-[var(--ret-text)]";
	return "text-[var(--ret-text-muted)]";
}
