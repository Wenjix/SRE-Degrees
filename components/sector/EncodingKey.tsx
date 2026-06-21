import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

// A compact, self-documenting "encoding key" — the legend that teaches a
// surface's visual grammar at a glance (Wattenberger: make the grammar legible,
// don't make the operator guess). Ink + mono only; it never introduces color.
// Each item may lead with a glyph. Decorative-to-AT, so aria-hidden.
export type KeyItem = { icon?: LucideIcon; label: string };

export function EncodingKey({ items, className }: { items: KeyItem[]; className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]",
				className,
			)}
		>
			{items.map((it, i) => {
				const Icon = it.icon;
				return (
					<span key={i} className="inline-flex items-center gap-1">
						{Icon ? <Icon className="h-2.5 w-2.5" strokeWidth={1.75} aria-hidden="true" /> : null}
						{it.label}
					</span>
				);
			})}
		</div>
	);
}
