"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { CHIP_TYPES, type ChipType } from "@/lib/world-query";

// The Causal Search Engine bar: type filter chips + a real parser input. Sits
// over the globe, bottom-center (faithful to the reference).
export function CausalSearch({
	chip,
	onChip,
	onQuery,
}: {
	chip: ChipType;
	onChip: (c: ChipType) => void;
	onQuery: (text: string) => void;
}) {
	const [text, setText] = useState("");
	return (
		<div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(560px,88%)] -translate-x-1/2 border border-[var(--ret-border)] bg-[var(--ret-bg)]/70 backdrop-blur-sm">
			<div className="flex flex-wrap gap-1 p-2">
				{CHIP_TYPES.map((c) => (
					<button
						key={c}
						type="button"
						aria-pressed={c === chip}
						onClick={() => onChip(c)}
						className={cn(
							"px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]",
							c === chip ? "bg-[var(--ret-accent)] text-[var(--ret-bg)]" : "text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
						)}
					>
						{c}
					</button>
				))}
			</div>
			<form
				className="flex items-center gap-2 border-t border-[var(--ret-border)] px-2.5 py-2"
				onSubmit={(e) => {
					e.preventDefault();
					onQuery(text);
				}}
			>
				<Search className="h-3.5 w-3.5 shrink-0 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
				<input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="ask: what depends on Atlas? · what's burning? · cost"
					className="w-full bg-transparent font-mono text-[12px] text-[var(--ret-text)] placeholder:text-[var(--ret-text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ret-accent)]"
					aria-label="Causal search"
				/>
			</form>
		</div>
	);
}
