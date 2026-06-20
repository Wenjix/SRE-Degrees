"use client";

import { memo } from "react";

export { formatDayShort } from "@/lib/date-format";

export const DashboardBarChart = memo(function DashboardBarChart({
	data,
	dataKey,
	xKey = "date",
	color = "var(--ret-accent)",
	height = 200,
	xFormatter,
	yFormatter,
	peakValue,
	peakLabel,
}: {
	data: Record<string, unknown>[];
	dataKey: string;
	xKey?: string;
	color?: string;
	height?: number;
	xFormatter?: (value: string) => string;
	yFormatter?: (value: number) => string;
	peakValue?: number;
	peakLabel?: string;
}) {
	const width = 720;
	if (!data.length) {
		return (
			<div
				className="flex items-center justify-center font-mono text-[12px] text-[var(--ret-text-muted)]"
				style={{ height }}
			>
				No data
			</div>
		);
	}

	const values = data.map((row) => Number(row[dataKey]) || 0);
	const max = Math.max(...values, peakValue ?? 0, 1);
	const chartTop = 16;
	const chartBottom = 34;
	const chartLeft = 38;
	const chartRight = 12;
	const chartHeight = height - chartTop - chartBottom;
	const chartWidth = width - chartLeft - chartRight;
	const slot = chartWidth / data.length;
	const barWidth = Math.max(14, slot * 0.52);
	const peakY =
		peakValue == null
			? null
			: chartTop + chartHeight - (peakValue / max) * chartHeight;

	return (
		<div className="w-full overflow-hidden" style={{ height }}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width="100%"
				height={height}
				role="img"
				aria-label="Bar chart"
				preserveAspectRatio="none"
			>
				{[0.25, 0.5, 0.75, 1].map((ratio) => {
					const y = chartTop + chartHeight - ratio * chartHeight;
					return (
						<g key={ratio}>
							<line
								x1={chartLeft}
								x2={width - chartRight}
								y1={y}
								y2={y}
								stroke="var(--ret-grid)"
								strokeDasharray="3 3"
								vectorEffect="non-scaling-stroke"
							/>
							<text
								x={0}
								y={y + 3}
								fill="var(--ret-text-muted)"
								fontFamily="var(--font-mono)"
								fontSize={10}
							>
								{yFormatter
									? yFormatter(max * ratio)
									: Math.round(max * ratio)}
							</text>
						</g>
					);
				})}
				{peakY != null ? (
					<g>
						<line
							x1={chartLeft}
							x2={width - chartRight}
							y1={peakY}
							y2={peakY}
							stroke="var(--ret-red)"
							strokeDasharray="4 3"
							vectorEffect="non-scaling-stroke"
						/>
						{peakLabel ? (
							<text
								x={width - chartRight}
								y={peakY - 5}
								textAnchor="end"
								fill="var(--ret-red)"
								fontFamily="var(--font-mono)"
								fontSize={10}
							>
								{peakLabel}
							</text>
						) : null}
					</g>
				) : null}
				{data.map((row, index) => {
					const value = values[index];
					const barHeight = (value / max) * chartHeight;
					const x = chartLeft + index * slot + (slot - barWidth) / 2;
					const y = chartTop + chartHeight - barHeight;
					const label = String(row[xKey] ?? "");
					const title = `${label}: ${yFormatter ? yFormatter(value) : value}`;
					return (
						<g key={`${label}-${index}`}>
							<title>{title}</title>
							<rect
								x={x}
								y={y}
								width={barWidth}
								height={barHeight}
								fill={color}
								fillOpacity={0.62}
							/>
							<text
								x={x + barWidth / 2}
								y={height - 10}
								textAnchor="middle"
								fill="var(--ret-text-muted)"
								fontFamily="var(--font-mono)"
								fontSize={10}
							>
								{xFormatter ? xFormatter(label) : label}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
});
