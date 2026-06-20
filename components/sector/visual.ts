import {
	Database,
	Eye,
	Lock,
	RefreshCw,
	Route,
	Scaling,
	Siren,
	Wrench,
	type LucideIcon,
} from "lucide-react";

import type { AgentStatus, AgentToolIcon } from "@/lib/sre-data";

// Status -> the one saturated color it is allowed to use anywhere.
export const STATUS_COLOR_VAR: Record<AgentStatus, string> = {
	healthy: "var(--ret-green)",
	degraded: "var(--ret-amber)",
	critical: "var(--ret-red)",
	idle: "var(--ret-text-muted)",
};

// data-sev attribute value drives every motion cue in globals.css.
export function severity(status: AgentStatus): "calm" | "warn" | "crit" | "idle" {
	switch (status) {
		case "critical":
			return "crit";
		case "degraded":
			return "warn";
		case "idle":
			return "idle";
		default:
			return "calm";
	}
}

export const TOOL_ICON: Record<AgentToolIcon, LucideIcon> = {
	route: Route,
	observe: Eye,
	heal: Wrench,
	page: Siren,
	scale: Scaling,
	data: Database,
	lock: Lock,
	sync: RefreshCw,
};

// Burn-rate -> fill fraction for the HealthSpine (capped at 4x).
export function burnFraction(burnRate: number): number {
	return Math.max(0.04, Math.min(1, burnRate / 4));
}
