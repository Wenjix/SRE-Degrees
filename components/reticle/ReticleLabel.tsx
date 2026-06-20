import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function ReticleLabel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p className={cn("text-[11px] uppercase text-[var(--ret-text-muted)]", className)}>
			{children}
		</p>
	);
}
