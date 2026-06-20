import { cn } from "@/lib/cn";
import {
	STATUS_RANK,
	type SreAgent,
	type ZoneDef,
} from "@/lib/sre-data";

import { STATUS_COLOR_VAR } from "./visual";

// A named tier region on the blueprint. Membership = whichever zone an agent's
// center falls inside. The aggregate health bar is the zone-level severity tell.
export function ZoneField({
	zone,
	agents,
	focused,
}: {
	zone: ZoneDef;
	agents: SreAgent[];
	focused: boolean;
}) {
	const total = agents.length;
	const counts = {
		critical: agents.filter((a) => a.status === "critical").length,
		degraded: agents.filter((a) => a.status === "degraded").length,
		healthy: agents.filter((a) => a.status === "healthy").length,
		idle: agents.filter((a) => a.status === "idle").length,
	};
	const worst = agents.reduce(
		(w, a) => (STATUS_RANK[a.status] > STATUS_RANK[w] ? a.status : w),
		"idle" as SreAgent["status"],
	);
	const okFrac = total ? counts.healthy / total : 0;

	return (
		<div
			data-zone-id={zone.id}
			className={cn(
				"absolute border border-dashed",
				focused ? "border-[var(--ret-border-strong)]" : "border-[var(--ret-rail)]",
			)}
			style={{ left: zone.rect.x, top: zone.rect.y, width: zone.rect.w, height: zone.rect.h }}
		>
			{/* zone header tab */}
			<div className="pointer-events-none absolute -top-px left-3 flex -translate-y-1/2 items-center gap-2 bg-[var(--ret-bg)] px-2">
				<span className="ret-display text-[12px] tracking-[0.18em] text-[var(--ret-text-secondary)]">
					{zone.title}
				</span>
				<span className="border border-[var(--ret-border)] px-1 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
					tier-{zone.tier}
				</span>
			</div>

			{/* aggregate health bar */}
			<div className="pointer-events-none absolute bottom-2 left-3 right-3">
				<div className="flex items-center justify-between font-mono text-[9px] text-[var(--ret-text-muted)]">
					<span>
						{counts.critical > 0 ? `${counts.critical} crit · ` : ""}
						{counts.degraded > 0 ? `${counts.degraded} warn · ` : ""}
						{counts.healthy} ok{counts.idle ? ` · ${counts.idle} idle` : ""}
					</span>
					<span>{total}</span>
				</div>
				<div className="mt-1 h-[3px] w-full bg-[var(--ret-border)]/50">
					<div
						className="h-full transition-[width] duration-500"
						style={{ width: `${Math.round(okFrac * 100)}%`, background: STATUS_COLOR_VAR[worst] }}
					/>
				</div>
			</div>
		</div>
	);
}
