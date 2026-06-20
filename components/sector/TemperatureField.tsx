"use client";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// The board temperature warms toward the fire: cool/neutral when healthy,
// amber as the fleet degrades, a red bloom when something is critical. Felt
// peripherally before it is read. Pure CSS opacity transition (no re-renders).
export function TemperatureField() {
	const { worstStatus } = useLens();
	const intensity = worstStatus === "critical" ? 0.2 : worstStatus === "degraded" ? 0.1 : 0;
	const color = worstStatus === "critical" ? STATUS_COLOR_VAR.critical : STATUS_COLOR_VAR.degraded;
	return (
		<div
			aria-hidden="true"
			className="ret-anim-fill pointer-events-none absolute inset-0 z-[5] transition-opacity duration-[1200ms]"
			style={{
				opacity: intensity,
				background: `radial-gradient(120% 90% at 72% 22%, ${color} 0%, transparent 58%)`,
				mixBlendMode: "screen",
			}}
		/>
	);
}
