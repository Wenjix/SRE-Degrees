"use client";

import { AgentDossier } from "./AgentDossier";
import { EvidenceLedger } from "./EvidenceLedger";
import { FleetSummary } from "./FleetSummary";
import { GroupLedger } from "./GroupLedger";
import { ListLens } from "./ListLens";
import { useLens } from "./LensProvider";
import { PromoteLens } from "./PromoteLens";
import { ScatterLens } from "./ScatterLens";
import { SectorCanvas } from "./SectorCanvas";
import { SoundToggle } from "./SoundToggle";
import { ViewModeSwitch } from "./ViewModeSwitch";

// The SECTOR console: one shared store projected through Canvas / List / Scatter,
// with the proximity GroupLedger rail and the L3 dossier overlay.
export function SectorWorkspace() {
	const { state } = useLens();
	const view = state.activeView;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* workspace header */}
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-2.5">
				<div className="flex min-w-0 items-center gap-3">
					<span className="ret-display truncate text-[14px] tracking-[0.16em]">RETICLE // SECTOR</span>
					<span className="hidden h-4 w-px bg-[var(--ret-border)] sm:block" aria-hidden="true" />
					<FleetSummary className="hidden sm:flex" />
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<ViewModeSwitch />
					<SoundToggle />
				</div>
			</div>

			{/* body */}
			<div className="flex min-h-0 flex-1">
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					{view !== "list" ? (
						<p className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-4 py-1.5 font-mono text-[10px] text-[var(--ret-text-dim)] md:hidden">
							Spatial view — best on a wider screen. Use <span className="text-[var(--ret-text)]">List</span> for dense triage on mobile.
						</p>
					) : null}
					<div className="relative min-h-0 flex-1">
						{view === "canvas" ? <SectorCanvas /> : null}
						{view === "list" ? <ListLens /> : null}
						{view === "scatter" ? <ScatterLens /> : null}
						{view === "promote" ? <PromoteLens /> : null}
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
