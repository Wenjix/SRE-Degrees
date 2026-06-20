import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "default" | "accent" | "success" | "warning" | "danger";

const VARIANT: Record<Variant, string> = {
	default: "border-[var(--ret-border)] text-[var(--ret-text-dim)]",
	accent:
		"border-[var(--ret-accent)]/30 bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]",
	success:
		"border-[var(--ret-green)]/30 bg-[var(--ret-green)]/10 text-[var(--ret-green)]",
	warning:
		"border-[var(--ret-amber)]/30 bg-[var(--ret-amber)]/10 text-[var(--ret-amber)]",
	danger:
		"border-[var(--ret-red)]/30 bg-[var(--ret-red)]/10 text-[var(--ret-red)]",
};

export function ReticleBadge({
	children,
	variant = "default",
	className,
}: {
	children: ReactNode;
	variant?: Variant;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] leading-tight",
				VARIANT[variant],
				className,
			)}
		>
			{children}
		</span>
	);
}
