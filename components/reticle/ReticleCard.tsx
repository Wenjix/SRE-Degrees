import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function ReticleCard({
	children,
	className,
	hoverable = true,
	as: Tag = "div",
}: {
	children: ReactNode;
	className?: string;
	hoverable?: boolean;
	as?: "div" | "li" | "article";
}) {
	return (
		<Tag
			className={cn(
				"border border-[var(--ret-border)] bg-[var(--ret-surface)]",
				hoverable &&
					"transition-colors duration-150 hover:border-[var(--ret-border-hover)]",
				className,
			)}
		>
			{children}
		</Tag>
	);
}
