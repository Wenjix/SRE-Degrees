import { BRAND } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function ReticleMark({
	size = 24,
	className,
	withWordmark = false,
}: {
	size?: number;
	className?: string;
	withWordmark?: boolean;
}) {
	const dim = `${size}px`;
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<span
				role="img"
				aria-label={BRAND.name}
				className="relative inline-flex shrink-0 items-center justify-center border border-[var(--ret-border-strong)] bg-[var(--ret-bg)]"
				style={{ width: dim, height: dim }}
			>
				<span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--ret-cross)]" />
				<span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--ret-cross)]" />
				<span className="h-1.5 w-1.5 bg-[var(--ret-accent)]" />
			</span>
			{withWordmark ? (
				<span className="whitespace-nowrap text-[15px] font-semibold text-[var(--ret-text)]">
					{BRAND.wordmark}
				</span>
			) : null}
		</span>
	);
}
