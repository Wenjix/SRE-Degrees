import { cn } from "@/lib/cn";
import type { AgentTool } from "@/lib/sre-data";

import { TOOL_ICON } from "./visual";

// Vertical column of the agent's bound MCP tools/capabilities. Idle tools sit
// dim; an active tool brightens (and flashes on invocation via globals.css).
export function ToolsRail({
	tools,
	className,
	iconSize = 13,
}: {
	tools: AgentTool[];
	className?: string;
	iconSize?: number;
}) {
	return (
		<div className={cn("flex flex-col items-center gap-1.5", className)} aria-hidden="true">
			{tools.map((tool) => {
				const Icon = TOOL_ICON[tool.icon];
				return (
					<span
						key={tool.id}
						title={tool.label}
						data-active={tool.active ? "true" : "false"}
						className={cn(
							"ret-tool inline-flex h-5 w-5 items-center justify-center",
							tool.active ? "text-[var(--ret-accent)]" : "text-[var(--ret-text-muted)]",
						)}
					>
						<Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.75} />
					</span>
				);
			})}
		</div>
	);
}
