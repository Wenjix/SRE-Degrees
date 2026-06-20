import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "default" | "ok" | "warn" | "error" | "accent";

const TONE: Record<Tone, string> = {
	default: "text-[var(--ret-text)]",
	ok: "text-[var(--ret-green)]",
	warn: "text-[var(--ret-amber)]",
	error: "text-[var(--ret-red)]",
	accent: "text-[var(--ret-accent)]",
};

export function MetricCard({
	label,
	value,
	hint,
	tone = "default",
	className,
	icon,
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	tone?: Tone;
	className?: string;
	icon?: ReactNode;
}) {
	return (
		<div
			className={cn(
				"bg-[var(--ret-bg)] p-3 transition-colors duration-150 hover:bg-[var(--ret-surface)]",
				className,
			)}
		>
			<p className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
				{icon ? <span className="inline-flex">{icon}</span> : null}
				{label}
			</p>
			<p className={cn("mt-2 font-mono text-base tabular-nums leading-none", TONE[tone])}>
				{value}
			</p>
			{hint ? (
				<p className="mt-1.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
					{hint}
				</p>
			) : null}
		</div>
	);
}
