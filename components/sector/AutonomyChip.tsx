import { Circle, Lock, LockOpen, Unlock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";
import { AUTONOMY_FILL_PCT, TIER_LABEL } from "@/lib/promotion";
import type { AutonomyTier } from "@/lib/sre-data";

// The single shared autonomy renderer. Autonomy is encoded WITHOUT saturated
// color (that stays health-only): a chain/shackle icon, a monochrome ink fill
// bar, and a mono tier label + RDY — used on tokens, the L2 card, the dossier,
// and ListLens cells.
const TIER_ICON: Record<AutonomyTier, LucideIcon> = {
	harnessed: Lock,
	supervised: LockOpen,
	guarded: Unlock,
	autonomous: Circle,
};

export function AutonomyChip({
	tier,
	readiness,
	compact = false,
	showBar = true,
	className,
}: {
	tier: AutonomyTier;
	readiness?: number;
	compact?: boolean;
	showBar?: boolean;
	className?: string;
}) {
	const Icon = TIER_ICON[tier];
	const fill = AUTONOMY_FILL_PCT[tier];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[var(--ret-text-dim)]",
				compact ? "text-[9px]" : "text-[10px]",
				className,
			)}
			title={`autonomy: ${TIER_LABEL[tier]}${readiness != null ? ` · readiness ${Math.round(readiness)}` : ""}`}
		>
			<Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={1.75} aria-hidden="true" />
			<span>{TIER_LABEL[tier]}</span>
			{showBar ? (
				<span className="relative inline-block h-1.5 w-7 bg-[var(--ret-border)]/50" aria-hidden="true">
					<span className="absolute inset-y-0 left-0 block bg-[var(--ret-text)]" style={{ width: `${fill}%` }} />
				</span>
			) : null}
			{readiness != null ? <span className="text-[var(--ret-text-muted)]">RDY {Math.round(readiness)}</span> : null}
		</span>
	);
}
