import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "frame" | "cellGrid" | "strip";

const VARIANT_CLASS: Record<Variant, string> = {
	frame: "border border-[var(--ret-border)] bg-[var(--ret-bg)]",
	cellGrid:
		"overflow-hidden border border-[var(--ret-border)] bg-[var(--ret-border)]",
	strip: "border-y border-[var(--ret-border)] bg-[var(--ret-bg)]",
};

export function DashboardPanel({
	variant = "frame",
	children,
	className,
}: {
	variant?: Variant;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn(VARIANT_CLASS[variant], className)}>
			{children}
		</section>
	);
}
