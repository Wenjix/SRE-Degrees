"use client";

import { useEffect, useState } from "react";

import { Library, MessageSquare, Network, ScrollText, Trophy, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import { CascadeLens } from "./CascadeLens";
import { CatalogLens } from "./CatalogLens";
import { LeaderboardLens } from "./LeaderboardLens";
import { ReplayLens } from "./ReplayLens";
import { VoicesLens } from "./VoicesLens";

export type CidgTab = "catalog" | "voices" | "leaderboard" | "cascade" | "replay";

const TABS: { id: CidgTab; label: string; hint: string; Icon: LucideIcon }[] = [
	{ id: "catalog", label: "Catalog", hint: "34 incidents", Icon: Library },
	{ id: "voices", label: "Voices", hint: "buyer signal", Icon: MessageSquare },
	{ id: "leaderboard", label: "Leaderboard", hint: "frontier sweep", Icon: Trophy },
	{ id: "cascade", label: "Cascade", hint: "propagate()", Icon: Network },
	{ id: "replay", label: "Replay", hint: "trajectory", Icon: ScrollText },
];

function isTab(v: string): v is CidgTab {
	return TABS.some((t) => t.id === v);
}

// CIDG // LAB — a self-contained console for the merged RL-environment data.
// A vertical tab rail (the user-requested layout) over five lenses; unlike the
// SECTOR console these read static, committed experiment data, not the live store.
export function LabWorkspace() {
	const [tab, setTab] = useState<CidgTab>("catalog");

	// Deep-linkable: /dashboard/lab#cascade selects that lens on load.
	useEffect(() => {
		const fromHash = window.location.hash.replace("#", "");
		if (isTab(fromHash)) setTab(fromHash);
	}, []);

	const select = (id: CidgTab) => {
		setTab(id);
		try {
			window.history.replaceState(null, "", `#${id}`);
		} catch {
			/* ignore */
		}
	};

	return (
		<div className="flex h-full min-h-0">
			{/* vertical tab rail */}
			<nav
				aria-label="CIDG Lab views"
				aria-orientation="vertical"
				role="tablist"
				className="flex w-[52px] shrink-0 flex-col border-r border-[var(--ret-border)] bg-[var(--ret-bg)] md:w-[184px]"
			>
				<div className="hidden h-[42px] items-center border-b border-[var(--ret-border)] px-4 md:flex">
					<span className="ret-display text-[13px] tracking-[0.16em]">CIDG // LAB</span>
				</div>
				<div className="flex flex-1 flex-col gap-0.5 py-2">
					{TABS.map(({ id, label, hint, Icon }) => {
						const active = tab === id;
						return (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => select(id)}
								title={`${label} — ${hint}`}
								className={cn(
									"group relative flex items-center gap-3 px-4 py-2 text-left outline-none transition-colors focus-visible:bg-[var(--ret-surface)]",
									active
										? "bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]"
										: "text-[var(--ret-text-dim)] hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"absolute inset-y-0 left-0 w-px",
										active ? "bg-[var(--ret-accent)]" : "bg-transparent",
									)}
								/>
								<Icon
									strokeWidth={1.75}
									className={cn(
										"h-4 w-4 shrink-0",
										active ? "text-[var(--ret-accent)]" : "text-[var(--ret-text-muted)] group-hover:text-[var(--ret-text-dim)]",
									)}
								/>
								<span className="hidden min-w-0 flex-1 md:block">
									<span className="block truncate text-[13px] font-medium leading-tight">{label}</span>
									<span className="block truncate font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">
										{hint}
									</span>
								</span>
							</button>
						);
					})}
				</div>
				<div className="hidden border-t border-[var(--ret-border)] px-4 py-2 font-mono text-[9px] leading-relaxed text-[var(--ret-text-muted)] md:block">
					merged via PR #3 · code-as-policy RL env
				</div>
			</nav>

			{/* lens content */}
			<div className="relative min-h-0 min-w-0 flex-1 overflow-auto">
				{tab === "catalog" ? <CatalogLens /> : null}
				{tab === "voices" ? <VoicesLens /> : null}
				{tab === "leaderboard" ? <LeaderboardLens /> : null}
				{tab === "cascade" ? <CascadeLens /> : null}
				{tab === "replay" ? <ReplayLens /> : null}
			</div>
		</div>
	);
}
