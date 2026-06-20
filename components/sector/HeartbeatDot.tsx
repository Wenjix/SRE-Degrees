import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { AgentStatus } from "@/lib/sre-data";

import { severity, STATUS_COLOR_VAR } from "./visual";

// The status dot IS the heartbeat. It pulses by severity (see globals.css);
// critical also emits an expanding SonarRing. Color is never the only signal —
// callers always pair this with a text label.
export function HeartbeatDot({
	status,
	size = 8,
	className,
	ring = true,
}: {
	status: AgentStatus;
	size?: number;
	className?: string;
	ring?: boolean;
}) {
	const sev = severity(status);
	const style = { "--hb-color": STATUS_COLOR_VAR[status], width: size, height: size } as CSSProperties;
	return (
		<span
			className={cn("ret-heartbeat relative inline-block shrink-0 align-middle", className)}
			data-sev={sev}
			style={style}
			aria-hidden="true"
		>
			<span className="block h-full w-full" style={{ background: "var(--hb-color)" }} />
			{ring && sev === "crit" ? <span className="ret-sonar" /> : null}
		</span>
	);
}
