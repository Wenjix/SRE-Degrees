import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import { RETICLE_SIZES } from "./constants";

type Props = {
	className?: string;
	style?: CSSProperties;
	size?: number;
};

export function ReticleCross({
	className,
	style,
	size = RETICLE_SIZES.crossArm * 4,
}: Props) {
	const center = size / 2;
	const arm = RETICLE_SIZES.crossArm;
	return (
		<svg
			aria-hidden="true"
			viewBox={`0 0 ${size} ${size}`}
			width={size}
			height={size}
			className={cn("pointer-events-none text-[var(--ret-cross)]", className)}
			style={style}
		>
			<path
				d={`M ${center - arm} ${center} H ${center + arm} M ${center} ${
					center - arm
				} V ${center + arm}`}
				stroke="currentColor"
				strokeWidth={RETICLE_SIZES.crossStroke}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
