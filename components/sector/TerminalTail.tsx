import { cn } from "@/lib/cn";

// Streaming mono log tail. Newest line carries the blinking .ret-caret. The
// `key` is intentionally the line index within the visible window so the caret
// stays pinned to the bottom as lines scroll.
export function TerminalTail({
	lines,
	maxLines = 5,
	caret = true,
	className,
}: {
	lines: string[];
	maxLines?: number;
	caret?: boolean;
	className?: string;
}) {
	const shown = lines.slice(-maxLines);
	return (
		<div
			className={cn(
				"ret-tail overflow-hidden border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2 py-1.5 font-mono text-[10px] leading-[1.55] text-[var(--ret-text-dim)]",
				className,
			)}
		>
			{shown.map((line, i) => {
				const last = i === shown.length - 1;
				const prompt = line.startsWith("$");
				const fail = /\b(FAIL|error|SLOW|paging)\b/i.test(line);
				return (
					<div
						key={i}
						className={cn(
							"truncate",
							prompt && "text-[var(--ret-text)]",
							fail && "text-[var(--ret-red)]",
						)}
					>
						{line}
						{last && caret ? <span className="ret-caret" /> : null}
					</div>
				);
			})}
		</div>
	);
}
