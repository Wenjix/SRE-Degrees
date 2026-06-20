import type { StatusTone } from "@/lib/navigation";
import { STATUS_TONE_CLASS } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function StatusPill({
	label,
	tone = "neutral",
	pulse = false,
	className,
}: {
	label: string;
	tone?: StatusTone;
	pulse?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] leading-tight",
				STATUS_TONE_CLASS[tone],
				className,
			)}
		>
			<span className={cn("h-1.5 w-1.5 bg-current", pulse && "animate-pulse")} aria-hidden="true" />
			{label}
		</span>
	);
}
