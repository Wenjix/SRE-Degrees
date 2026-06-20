import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
	width?: string | number;
	height?: string | number;
};

export function Skeleton({
	className,
	style,
	width,
	height,
	...rest
}: Props) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"ret-skeleton border border-[var(--ret-border)] bg-[var(--ret-bg-soft)]",
				className,
			)}
			style={{
				width: typeof width === "number" ? `${width}px` : width,
				height: typeof height === "number" ? `${height}px` : height,
				...style,
			}}
			{...rest}
		/>
	);
}
