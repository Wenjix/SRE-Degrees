"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

const FRAMES = {
	braille: ["-", "\\", "|", "/"],
	scan: ["[    ]", "[=   ]", "[==  ]", "[=== ]", "[====]", "[ ===]", "[  ==]", "[   =]"],
	orbit: [".", "o", "O", "o"],
} as const;

const INTERVAL_MS: Record<keyof typeof FRAMES, number> = {
	braille: 90,
	scan: 100,
	orbit: 120,
};

export type BrailleSpinnerName = keyof typeof FRAMES;

export function BrailleSpinner({
	name = "braille",
	label,
	className,
}: {
	name?: BrailleSpinnerName;
	label?: string;
	className?: string;
}) {
	const frames = FRAMES[name];
	const interval = INTERVAL_MS[name];
	const [i, setI] = useState(0);

	useEffect(() => {
		const reduce =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce) return;
		const id = window.setInterval(
			() => setI((prev) => (prev + 1) % frames.length),
			interval,
		);
		return () => window.clearInterval(id);
	}, [frames.length, interval]);

	const ariaLabel = label ? `${label} loading` : "Loading";

	return (
		<span
			role="status"
			aria-label={ariaLabel}
			className={cn(
				"inline-flex items-center gap-1.5 font-mono leading-none tabular-nums",
				className,
			)}
		>
			<span aria-hidden="true">{frames[i]}</span>
			{label ? <span>{label}</span> : null}
		</span>
	);
}
