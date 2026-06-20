import { cn } from "@/lib/cn";
import type { AgentStatus } from "@/lib/sre-data";

import { STATUS_COLOR_VAR } from "./visual";

// A small ~270deg gauge of remaining error budget. The remaining sweep is drawn
// in the status color over a faint track; a burning agent reads as a thin sliver.
export function ErrorBudgetArc({
	remainingPct,
	status,
	size = 30,
	className,
}: {
	remainingPct: number;
	status: AgentStatus;
	size?: number;
	className?: string;
}) {
	const stroke = 3;
	const r = (size - stroke) / 2;
	const cx = size / 2;
	const cy = size / 2;
	const sweep = 270; // degrees of usable arc
	const start = 135; // bottom-left, sweeping clockwise to bottom-right
	const circ = 2 * Math.PI * r;
	const arcLen = (sweep / 360) * circ;
	const remain = Math.max(0, Math.min(100, remainingPct)) / 100;

	const toXY = (deg: number) => {
		const rad = (deg * Math.PI) / 180;
		return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
	};
	const [sx, sy] = toXY(start);
	const [ex, ey] = toXY(start + sweep);
	const large = sweep > 180 ? 1 : 0;
	const trackPath = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className={cn("shrink-0", className)}
			role="img"
			aria-label={`error budget ${Math.round(remainingPct)}% remaining`}
		>
			<path d={trackPath} fill="none" stroke="var(--ret-border)" strokeWidth={stroke} strokeLinecap="butt" />
			<path
				d={trackPath}
				fill="none"
				stroke={STATUS_COLOR_VAR[status]}
				strokeWidth={stroke}
				strokeLinecap="butt"
				strokeDasharray={`${(arcLen * remain).toFixed(2)} ${circ.toFixed(2)}`}
			/>
		</svg>
	);
}
