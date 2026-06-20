"use client";

import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function ReticleSelect({
	className,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"h-8 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-2 text-[12px] text-[var(--ret-text)] outline-none transition-colors hover:border-[var(--ret-border-hover)] focus:border-[var(--ret-accent)]",
				className,
			)}
			{...props}
		/>
	);
}
