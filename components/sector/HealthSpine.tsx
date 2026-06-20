import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { AgentStatus } from "@/lib/sre-data";

import { burnFraction, STATUS_COLOR_VAR } from "./visual";

// Always-on left-edge severity tell: a thin track whose fill height = SLO burn
// rate and whose color = status. Reads at any zoom, even when text is illegible.
export function HealthSpine({
	status,
	burnRate,
	className,
}: {
	status: AgentStatus;
	burnRate: number;
	className?: string;
}) {
	const fill = Math.round(burnFraction(burnRate) * 100);
	const color = STATUS_COLOR_VAR[status];
	return (
		<span
			className={cn("absolute inset-y-0 left-0 w-[3px] bg-[var(--ret-border)]/60", className)}
			aria-hidden="true"
		>
			<span
				className="absolute inset-x-0 bottom-0 block transition-[height] duration-500"
				style={{ height: `${fill}%`, background: color, "--hb-color": color } as CSSProperties}
			/>
		</span>
	);
}
