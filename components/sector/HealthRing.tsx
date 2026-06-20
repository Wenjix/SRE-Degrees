"use client";

import { useEffect, useRef, useState } from "react";

import { STATUS_RANK } from "@/lib/sre-data";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// One-shot expanding pulse across the active view when fleet health steps to a
// worse state — the "something just went red" tell. Self-clears on animation end.
export function HealthRing() {
	const { worstStatus } = useLens();
	const prev = useRef(worstStatus);
	const seq = useRef(0);
	const [ping, setPing] = useState<{ key: number; color: string } | null>(null);

	useEffect(() => {
		if (STATUS_RANK[worstStatus] > STATUS_RANK[prev.current]) {
			seq.current += 1;
			setPing({ key: seq.current, color: STATUS_COLOR_VAR[worstStatus] });
		}
		prev.current = worstStatus;
	}, [worstStatus]);

	if (!ping) return null;
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center">
			<span
				key={ping.key}
				onAnimationEnd={() => setPing(null)}
				className="ret-health-ring block h-48 w-48 border-2"
				style={{ borderColor: ping.color }}
			/>
		</div>
	);
}
