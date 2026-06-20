import { cn } from "@/lib/cn";

export function StatCard({
	label,
	value,
	unit,
	badge,
	subtext,
	className,
}: {
	label: string;
	value: string | number;
	unit?: string;
	badge?: React.ReactNode;
	subtext?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative flex flex-col items-center justify-center border border-[var(--ret-border)] bg-[var(--ret-bg)] px-6 py-6 text-center",
				className,
			)}
		>
			{badge ? <div className="absolute left-2 top-2">{badge}</div> : null}
			<span className="mb-2 font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
				{label}
			</span>
			<span className="text-4xl font-semibold tabular-nums text-[var(--ret-text)]">
				{value}
				{unit ? (
					<span className="ml-1 font-mono text-[13px] text-[var(--ret-text-dim)]">
						{unit}
					</span>
				) : null}
			</span>
			{subtext ? (
				<span className="absolute bottom-2 right-3 font-mono text-[10px] text-[var(--ret-text-muted)]">
					{subtext}
				</span>
			) : null}
		</div>
	);
}
