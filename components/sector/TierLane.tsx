import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { AUTONOMY_FILL_PCT, TIER_LABEL, TIER_MEANING } from "@/lib/promotion";
import type { AutonomyTier } from "@/lib/sre-data";

// Background column for one autonomy tier: header + meaning + autonomy-fill
// legend + a hatch->solid texture that lightens as autonomy increases.
const HATCH_OPACITY: Record<AutonomyTier, number> = {
	harnessed: 0.5,
	supervised: 0.3,
	guarded: 0.14,
	autonomous: 0,
};

export function TierLane({
	tier,
	count,
	className,
	style,
}: {
	tier: AutonomyTier;
	count: number;
	className?: string;
	style?: CSSProperties;
}) {
	const fill = AUTONOMY_FILL_PCT[tier];
	return (
		<div
			className={cn("relative h-full overflow-hidden border-r border-dashed border-[var(--ret-rail)] last:border-r-0", className)}
			style={style}
		>
			<div
				className="pointer-events-none absolute inset-0"
				aria-hidden="true"
				style={{
					opacity: HATCH_OPACITY[tier],
					backgroundImage: "repeating-linear-gradient(45deg, var(--ret-border) 0 1px, transparent 1px 9px)",
				}}
			/>
			<div className="relative border-b border-[var(--ret-border)] bg-[var(--ret-bg)]/70 px-3 py-2 backdrop-blur-sm">
				<div className="flex items-center justify-between gap-2">
					<span className="ret-display text-[12px] tracking-[0.14em]">{TIER_LABEL[tier]}</span>
					<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{count}</span>
				</div>
				<p className="mt-0.5 truncate font-mono text-[9px] text-[var(--ret-text-muted)]">{TIER_MEANING[tier]}</p>
				<div className="mt-1.5 h-1 w-full bg-[var(--ret-border)]/50" aria-hidden="true">
					<span className="block h-full bg-[var(--ret-text)]" style={{ width: `${fill}%` }} />
				</div>
			</div>
		</div>
	);
}
