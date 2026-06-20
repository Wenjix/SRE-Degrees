import { cn } from "@/lib/cn";
import { ENV_ORDER, ENV_RANK } from "@/lib/promotion";
import type { ProvingEnv } from "@/lib/sre-data";

// sandbox -> shadow -> canary -> production, ascending realism/blast-radius.
// done = dim tick, active = accent, locked = hairline; the required env is marked.
export function ProvingStepper({
	current,
	required,
	className,
}: {
	current: ProvingEnv;
	required?: ProvingEnv;
	className?: string;
}) {
	const cur = ENV_RANK[current];
	return (
		<div className={cn("flex items-center gap-1", className)}>
			{ENV_ORDER.map((env, i) => {
				const rank = ENV_RANK[env];
				const state = rank < cur ? "done" : rank === cur ? "active" : "locked";
				const isRequired = required === env;
				return (
					<div key={env} className="flex items-center gap-1">
						<span
							className={cn(
								"inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase",
								state === "active" && "border-[var(--ret-accent)] text-[var(--ret-text)]",
								state === "done" && "border-[var(--ret-border)] text-[var(--ret-text-dim)]",
								state === "locked" && "border-[var(--ret-border)] text-[var(--ret-text-muted)] opacity-60",
							)}
							title={isRequired ? `${env} (required for next tier)` : env}
						>
							<span
								className="h-1.5 w-1.5"
								style={{ background: state === "active" ? "var(--ret-accent)" : "var(--ret-text-muted)" }}
								aria-hidden="true"
							/>
							{env}
							{isRequired ? <span className="text-[var(--ret-text-muted)]">•</span> : null}
						</span>
						{i < ENV_ORDER.length - 1 ? <span className="text-[var(--ret-text-muted)]">›</span> : null}
					</div>
				);
			})}
		</div>
	);
}
