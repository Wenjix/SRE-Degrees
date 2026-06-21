"use client";

import { Inbox } from "lucide-react";

import { SEVERITY_LABEL, severityTone } from "@/lib/sre-data";

import { AgentDossier } from "./AgentDossier";
import { BlastLens } from "./BlastLens";
import { WorldLens } from "./WorldLens";
import { EvidenceLedger } from "./EvidenceLedger";
import { FleetLens } from "./FleetLens";
import { FleetSummary } from "./FleetSummary";
import { GroupLedger } from "./GroupLedger";
import { IncidentLens } from "./IncidentLens";
import { ListLens } from "./ListLens";
import { useLens } from "./LensProvider";
import { PromoteLens } from "./PromoteLens";
import { QueueLens } from "./QueueLens";
import { ScatterLens } from "./ScatterLens";
import { SectorCanvas } from "./SectorCanvas";
import { SoundToggle } from "./SoundToggle";
import { ViewModeSwitch } from "./ViewModeSwitch";
import { STATUS_COLOR_VAR } from "./visual";

const MIN = 60_000;
function dur(ms: number) {
	const m = Math.floor(ms / MIN);
	return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// The SECTOR console: one shared store projected through Canvas / List / Scatter /
// Promote / Incidents / Queue, with the proximity rail and the L3 dossier overlay.
export function SectorWorkspace() {
	const { state, setView } = useLens();
	const view = state.activeView;
	const spatial = view === "canvas" || view === "scatter" || view === "promote";

	const crises = state.incidents.filter((i) => i.severity <= 2);
	const worst = crises.length
		? [...crises].sort((a, b) => a.severity - b.severity || b.ageMs - a.ageMs)[0]
		: null;
	const pendingCount = state.pendingActions.length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* active-incident banner — health-colored, the one thing that should pull focus */}
			{worst && view !== "incidents" ? (
				<button
					type="button"
					onClick={() => setView("incidents")}
					className="flex w-full items-center gap-2.5 border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-4 py-1.5 text-left outline-none transition-colors hover:bg-[var(--ret-surface)] focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
				>
					<span
						className="ret-pulse h-2 w-2 shrink-0 rounded-full"
						style={{ backgroundColor: STATUS_COLOR_VAR[severityTone(worst.severity)] }}
						aria-hidden="true"
					/>
					<span
						className="shrink-0 font-mono text-[11px] font-semibold"
						style={{ color: STATUS_COLOR_VAR[severityTone(worst.severity)] }}
					>
						{SEVERITY_LABEL[worst.severity]}
					</span>
					<span className="truncate font-mono text-[11px] text-[var(--ret-text)]">{worst.title}</span>
					<span className="hidden shrink-0 font-mono text-[10px] text-[var(--ret-text-dim)] sm:inline">
						{worst.service} · {dur(worst.ageMs)} · {worst.trend}
					</span>
					{crises.length > 1 ? (
						<span className="shrink-0 font-mono text-[10px] text-[var(--ret-text-muted)]">+{crises.length - 1} more</span>
					) : null}
					<span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">view →</span>
				</button>
			) : null}

			{/* workspace header */}
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-2.5">
				<div className="flex min-w-0 items-center gap-3">
					<span className="ret-display truncate text-[14px] tracking-[0.16em]">RETICLE // SECTOR</span>
					<span className="hidden h-4 w-px bg-[var(--ret-border)] sm:block" aria-hidden="true" />
					<FleetSummary className="hidden sm:flex" />
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{pendingCount > 0 && view !== "queue" ? (
						<button
							type="button"
							onClick={() => setView("queue")}
							className="flex items-center gap-1.5 border border-[var(--ret-accent)] px-2 py-1 font-mono text-[11px] text-[var(--ret-accent)] outline-none transition-colors hover:bg-[var(--ret-accent)] hover:text-[var(--ret-bg)] focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]"
						>
							<Inbox className="h-3.5 w-3.5" strokeWidth={1.75} />
							<span className="hidden sm:inline">{pendingCount} need you</span>
							<span className="sm:hidden">{pendingCount}</span>
						</button>
					) : null}
					<ViewModeSwitch />
					<SoundToggle />
				</div>
			</div>

			{/* body */}
			<div className="flex min-h-0 flex-1">
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					{spatial ? (
						<p className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-4 py-1.5 font-mono text-[10px] text-[var(--ret-text-dim)] md:hidden">
							Spatial view — best on a wider screen. Use <span className="text-[var(--ret-text)]">List</span> for dense triage on mobile.
						</p>
					) : null}
					<div className="relative min-h-0 flex-1">
						{view === "canvas" ? <SectorCanvas /> : null}
						{view === "list" ? <ListLens /> : null}
						{view === "scatter" ? <ScatterLens /> : null}
						{view === "promote" ? <PromoteLens /> : null}
						{view === "incidents" ? <IncidentLens /> : null}
						{view === "queue" ? <QueueLens /> : null}
						{view === "fleet" ? <FleetLens /> : null}
						{view === "blast" ? <BlastLens /> : null}
						{view === "world" ? <WorldLens /> : null}
					</div>
				</div>
				{view === "canvas" || view === "scatter" ? (
					<aside className="hidden w-[244px] shrink-0 border-l border-[var(--ret-border)] bg-[var(--ret-bg)] xl:block">
						<GroupLedger />
					</aside>
				) : null}
				{view === "promote" ? (
					<aside className="hidden w-[244px] shrink-0 border-l border-[var(--ret-border)] bg-[var(--ret-bg)] xl:block">
						<EvidenceLedger />
					</aside>
				) : null}
			</div>

			<AgentDossier />
		</div>
	);
}
