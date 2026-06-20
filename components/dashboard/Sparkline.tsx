"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";

export function Sparkline({
	values,
	width = 120,
	height = 28,
	className,
	stroke = "var(--ret-text)",
	fill = false,
	baseline,
	ariaLabel,
}: {
	values: number[];
	width?: number;
	height?: number;
	className?: string;
	stroke?: string;
	fill?: boolean;
	baseline?: number;
	ariaLabel?: string;
}) {
	const path = useMemo(() => {
		if (values.length === 0) return "";
		const max = Math.max(...values);
		const min = baseline ?? Math.min(...values);
		const range = max - min || 1;
		const dx = values.length > 1 ? width / (values.length - 1) : 0;
		return values
			.map((value, index) => {
				const x = index * dx;
				const y = height - ((value - min) / range) * height;
				return `${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(" ");
	}, [values, width, height, baseline]);

	const fillPath = useMemo(() => {
		if (!fill || values.length === 0) return "";
		return `M0,${height} L${path.replace(/ /g, " L")} L${width},${height} Z`;
	}, [fill, path, height, width, values.length]);

	if (values.length === 0) {
		return (
			<svg
				width={width}
				height={height}
				className={cn("inline-block", className)}
				aria-label={ariaLabel ?? "no data"}
				role="img"
			>
				<line
					x1={0}
					y1={height / 2}
					x2={width}
					y2={height / 2}
					stroke="var(--ret-border)"
					strokeWidth={1}
					strokeDasharray="2,2"
				/>
			</svg>
		);
	}

	const min = baseline ?? Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;
	const lastY = height - ((values[values.length - 1] - min) / range) * height;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className={cn("inline-block", className)}
			role="img"
			aria-label={ariaLabel}
		>
			{fill ? <path d={fillPath} fill={stroke} fillOpacity={0.12} /> : null}
			<polyline
				points={path}
				stroke={stroke}
				strokeWidth={1.4}
				fill="none"
				vectorEffect="non-scaling-stroke"
			/>
			<circle cx={width} cy={lastY} r={2} fill={stroke} />
		</svg>
	);
}
