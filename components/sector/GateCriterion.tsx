import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/cn";
import type { Criterion } from "@/lib/promotion";

const MS_PER_HOUR = 3_600_000;
function fmtH(ms: number) {
	const h = Math.floor(ms / MS_PER_HOUR);
	const m = Math.floor((ms % MS_PER_HOUR) / 60_000);
	return m ? `${h}h ${m}m` : `${h}h`;
}

function format(c: Criterion): string {
	switch (c.kind) {
		case "count":
			return `${Math.round(c.current)} / ${c.target}`;
		case "pct":
			return `${c.current.toFixed(2)}% / ${c.inverted ? "≤" : ""}${c.target.toFixed(2)}%`;
		case "time":
			return `${fmtH(c.current)} / ${fmtH(c.target)}`;
		case "binary":
			return c.current === 0 ? "none in soak" : `${c.current} incident${c.current > 1 ? "s" : ""}`;
		case "env":
			return `${c.currentEnv} / ${c.requiredEnv}`;
		default:
			return "";
	}
}

// One verifiable promotion criterion: label, current/target, progress fill, pass.
export function GateCriterion({ criterion, className }: { criterion: Criterion; className?: string }) {
	const c = criterion;
	return (
		<div className={cn("border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5", className)}>
			<div className="flex items-center justify-between gap-1">
				<span className="truncate font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">{c.label}</span>
				<span
					className={cn(
						"inline-flex h-3 w-3 shrink-0 items-center justify-center",
						c.pass ? "text-[var(--ret-green)]" : "text-[var(--ret-text-muted)]",
					)}
					aria-label={c.pass ? "pass" : "pending"}
				>
					{c.pass ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Minus className="h-3 w-3" strokeWidth={2} />}
				</span>
			</div>
			<div className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[var(--ret-text)]">{format(c)}</div>
			<div className="mt-1 h-[3px] w-full bg-[var(--ret-border)]/50" aria-hidden="true">
				<span
					className={cn("block h-full", c.pass ? "bg-[var(--ret-accent)]" : "bg-[var(--ret-text-dim)]")}
					style={{ width: `${Math.round(c.fraction * 100)}%` }}
				/>
			</div>
		</div>
	);
}
