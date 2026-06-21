"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { worldHeadcount, worldNodes } from "@/lib/world";
import { chipFilter, parseQuery, type ChipType, type QueryResult } from "@/lib/world-query";

import { CausalSearch } from "./CausalSearch";
import { useLens } from "./LensProvider";
import { WorldCodePanel } from "./WorldCodePanel";
import { WorldGlobe } from "./WorldGlobe";

// The // WORLD lens: the fleet's production estate as a globe, the Causal Search
// Engine bridging it to a live code slice. View-local query/chip state; the
// shared selectedId is the cross-lens link.
export function WorldLens({ className }: { className?: string }) {
	const { state, select, focusZone } = useLens();
	const agents = state.agents;
	const nodes = useMemo(() => worldNodes(agents), [agents]);
	const headcount = useMemo(() => worldHeadcount(agents), [agents]);

	const [chip, setChip] = useState<ChipType>("all");
	const [result, setResult] = useState<QueryResult | null>(() =>
		state.selectedId ? parseQuery(`depends on ${agents.find((a) => a.id === state.selectedId)?.name ?? ""}`, agents) : null,
	);

	const typeFilter = result?.typeFilter ?? chipFilter(chip);
	const focusIds = useMemo(() => {
		const ids = new Set<string>(result?.focusAgentIds ?? []);
		if (typeFilter) for (const n of nodes) if (n.type === typeFilter && n.agentId) ids.add(n.agentId);
		return ids;
	}, [result, typeFilter, nodes]);

	const runQuery = (text: string) => {
		setChip("all");
		setResult(parseQuery(text, agents));
	};
	const pickChip = (c: ChipType) => {
		setChip(c);
		setResult(c === "all" ? null : { intent: "filter", title: `${c} nodes`, summary: "", focusAgentIds: [], typeFilter: chipFilter(c) });
	};
	const pickAnchor = (agentId: string) => {
		select(agentId);
		const a = agents.find((x) => x.id === agentId);
		if (a) {
			focusZone(a.zone);
			setResult(parseQuery(`depends on ${a.name}`, agents));
		}
	};

	return (
		<div className={cn("flex h-full min-h-0", className)}>
			<div className="relative min-w-0 flex-1">
				<WorldGlobe nodes={nodes} focusIds={focusIds} selectedId={state.selectedId} onPick={pickAnchor} />
				<CausalSearch chip={chip} onChip={pickChip} onQuery={runQuery} />
				{result?.summary ? (
					<div className="pointer-events-none absolute left-4 top-4 max-w-[280px] border border-[var(--ret-border)] bg-[var(--ret-bg)]/70 px-3 py-2 font-mono text-[11px] text-[var(--ret-text-dim)] backdrop-blur-sm">
						{result.summary}
					</div>
				) : null}
			</div>
			<WorldCodePanel agents={agents} result={result} headcount={headcount} />
		</div>
	);
}
