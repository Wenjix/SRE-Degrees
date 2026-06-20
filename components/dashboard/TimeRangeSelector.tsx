"use client";

import { cn } from "@/lib/cn";

export type TimeRangeOption = { label: string; value: number };

export const RANGE_OPTIONS = [
	{ label: "24h", value: 1 },
	{ label: "7d", value: 7 },
	{ label: "30d", value: 30 },
] satisfies TimeRangeOption[];

export function TimeRangeSelector({
	options,
	selected,
	onSelect,
	className,
}: {
	options: TimeRangeOption[];
	selected: number;
	onSelect: (value: number) => void;
	className?: string;
}) {
	return (
		<div className={cn("inline-flex items-center gap-2", className)}>
			<span className="font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
				Range
			</span>
			<div className="inline-flex overflow-hidden border border-[var(--ret-border)] bg-[var(--ret-bg-soft)]">
				{options.map((opt) => (
					<button
						key={opt.value}
						type="button"
						onClick={() => onSelect(opt.value)}
						className={cn(
							"px-3 py-1.5 font-mono text-[11px] transition-colors",
							selected === opt.value
								? "bg-[var(--ret-bg)] text-[var(--ret-text)] shadow-[0_0_0_1px_var(--ret-border)]"
								: "text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
						)}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}
