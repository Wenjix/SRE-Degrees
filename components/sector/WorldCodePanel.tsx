"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { Incident, SreAgent } from "@/lib/sre-data";
import { taxonomyRows } from "@/lib/world";
import { toHarness, toWorldModel } from "@/lib/world-code";
import type { QueryResult } from "@/lib/world-query";

import { STATUS_COLOR_VAR } from "./visual";

const grp = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Render a generated code string monochrome-except-health: a line carrying ✗ or
// a burn value shows its trailing comment in the critical (health) color.
function CodeBlock({ code }: { code: string }) {
	return (
		<pre className="flex-1 overflow-auto whitespace-pre px-3 py-2.5 font-mono text-[11.5px] leading-[1.55] text-[var(--ret-text-dim)]">
			{code.split("\n").map((line, i) => {
				const bm = line.match(/burnRate: (\d+(?:\.\d+)?)/);
				const hot = line.includes("✗") || (bm !== null && parseFloat(bm[1]) > 1);
				return (
					<div key={i} style={hot ? { color: STATUS_COLOR_VAR.critical } : undefined}>
						{line || " "}
					</div>
				);
			})}
		</pre>
	);
}

export function WorldCodePanel({ agents, result, headcount, incidents }: { agents: SreAgent[]; result: QueryResult | null; headcount: number; incidents: Incident[] }) {
	const [view, setView] = useState<"model" | "harness">("model");
	const rows = useMemo(() => taxonomyRows(agents), [agents]);
	const code = useMemo(() => {
		if (!result) return null;
		return view === "model" ? toWorldModel(result, agents, incidents) : toHarness(result, agents, incidents);
	}, [result, agents, view, incidents]);

	return (
		<aside className="flex w-[330px] shrink-0 flex-col border-l border-[var(--ret-border)] bg-[var(--ret-bg)]">
			<div className="border-b border-[var(--ret-border)] px-3 py-2.5">
				<div className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Modeled production estate</div>
				<div className="mt-0.5 font-mono text-[18px] tabular-nums">{grp(headcount)}</div>
				<div className="font-mono text-[10px] text-[var(--ret-text-muted)]">entities · {rows.length} node types</div>
			</div>

			{result && code ? (
				<>
					<div className="flex items-center justify-between gap-2 border-b border-[var(--ret-border)] px-3 py-2">
						<span className="truncate font-mono text-[11px] text-[var(--ret-text)]">{result.title}</span>
						<div className="flex shrink-0 border border-[var(--ret-border)]">
							{(["model", "harness"] as const).map((m) => (
								<button
									key={m}
									type="button"
									aria-pressed={view === m}
									onClick={() => setView(m)}
									className={cn(
										"px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]",
										view === m ? "bg-[var(--ret-accent)] text-[var(--ret-bg)]" : "text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
									)}
								>
									{m === "model" ? "World model" : "Harness"}
								</button>
							))}
						</div>
					</div>
					<CodeBlock code={code} />
				</>
			) : (
				<ul className="flex-1 overflow-y-auto px-3 py-2">
					{rows.map((r) => (
						<li key={r.type} className="flex items-center justify-between border-b border-[var(--ret-border)]/50 py-1 font-mono text-[11px]">
							<span className={r.real ? "text-[var(--ret-text)]" : "text-[var(--ret-text-dim)]"}>{r.type}</span>
							<span className="tabular-nums text-[var(--ret-text-muted)]">{grp(r.count)}</span>
						</li>
					))}
				</ul>
			)}
		</aside>
	);
}
