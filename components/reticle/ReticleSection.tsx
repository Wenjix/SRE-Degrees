import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const SECTION_HATCH =
	"repeating-linear-gradient(135deg, var(--ret-rail) 0 1px, transparent 1px 5px)";

export function ReticleSection({
	children,
	className,
	contentClassName = "px-5 py-8",
	background = "none",
	as: Tag = "section",
	id,
}: {
	children: ReactNode;
	className?: string;
	contentClassName?: string;
	background?: "none" | "hatch";
	as?: "section" | "div" | "header" | "footer" | "main";
	id?: string;
}) {
	return (
		<Tag id={id} className={cn("relative", className)}>
			<div
				className={cn(
					"relative z-10 mx-auto w-full max-w-[var(--ret-content-max)]",
					background === "hatch" ? null : "bg-[var(--ret-bg)]",
					contentClassName,
				)}
				style={background === "hatch" ? { backgroundImage: SECTION_HATCH } : undefined}
			>
				{children}
			</div>
		</Tag>
	);
}
