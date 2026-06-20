"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/cn";
import { STATUS_RANK, type SreAgent } from "@/lib/sre-data";

import { useLens } from "./LensProvider";
import { STATUS_COLOR_VAR } from "./visual";

// latency (x) x error-budget remaining (y). Outliers fall to the lower-right
// (slow + budget burning). Click a point to select; drag a box to brush-select
// the worst agent inside. A live projection of the same store.
const VB = { w: 760, h: 440 };
const PAD = { l: 52, r: 20, t: 20, b: 40 };
const MAX_LAT = 600;

export function ScatterLens({ className }: { className?: string }) {
	const { state, select, open } = useLens();
	const svgRef = useRef<SVGSVGElement>(null);
	const [brush, setBrush] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
	const dragging = useRef(false);

	const plotW = VB.w - PAD.l - PAD.r;
	const plotH = VB.h - PAD.t - PAD.b;
	const px = (lat: number) => PAD.l + (Math.min(lat, MAX_LAT) / MAX_LAT) * plotW;
	const py = (eb: number) => PAD.t + (1 - Math.max(0, Math.min(100, eb)) / 100) * plotH;

	const toSvg = (e: ReactPointerEvent) => {
		const svg = svgRef.current;
		if (!svg) return { x: 0, y: 0 };
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const ctm = svg.getScreenCTM();
		if (!ctm) return { x: 0, y: 0 };
		const p = pt.matrixTransform(ctm.inverse());
		return { x: p.x, y: p.y };
	};

	const onBgDown = (e: ReactPointerEvent<SVGRectElement>) => {
		const { x, y } = toSvg(e);
		dragging.current = true;
		svgRef.current?.setPointerCapture(e.pointerId);
		setBrush({ x0: x, y0: y, x1: x, y1: y });
	};
	const onMove = (e: ReactPointerEvent) => {
		if (!dragging.current || !brush) return;
		const { x, y } = toSvg(e);
		setBrush({ ...brush, x1: x, y1: y });
	};
	const onUp = (e: ReactPointerEvent) => {
		if (!dragging.current) return;
		dragging.current = false;
		try {
			svgRef.current?.releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		if (!brush) return;
		const x0 = Math.min(brush.x0, brush.x1);
		const x1 = Math.max(brush.x0, brush.x1);
		const y0 = Math.min(brush.y0, brush.y1);
		const y1 = Math.max(brush.y0, brush.y1);
		setBrush(null);
		if (Math.abs(x1 - x0) < 6 && Math.abs(y1 - y0) < 6) {
			select(null);
			return;
		}
		const inside = state.agents.filter((a) => {
			const x = px(a.latencyMs);
			const y = py(a.errorBudget.remainingPct);
			return x >= x0 && x <= x1 && y >= y0 && y <= y1;
		});
		if (inside.length === 0) {
			select(null);
			return;
		}
		const worst = inside.sort(
			(a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.slo.burnRate - a.slo.burnRate,
		)[0];
		select(worst.id);
	};

	return (
		<div className={cn("relative h-full w-full p-3", className)}>
			<svg
				ref={svgRef}
				viewBox={`0 0 ${VB.w} ${VB.h}`}
				preserveAspectRatio="xMidYMid meet"
				className="h-full w-full select-none"
				onPointerMove={onMove}
				onPointerUp={onUp}
				onPointerCancel={onUp}
				role="group"
				aria-label="Latency versus error budget scatter. Use the list view for keyboard access."
			>
				{/* gridlines */}
				{[0, 25, 50, 75, 100].map((t) => (
					<g key={`y${t}`}>
						<line x1={PAD.l} y1={py(t)} x2={VB.w - PAD.r} y2={py(t)} stroke="var(--ret-grid)" strokeWidth={1} />
						<text x={PAD.l - 8} y={py(t) + 3} textAnchor="end" className="fill-[var(--ret-text-muted)] font-mono text-[10px]">
							{t}
						</text>
					</g>
				))}
				{[0, 150, 300, 450, 600].map((t) => (
					<g key={`x${t}`}>
						<line x1={px(t)} y1={PAD.t} x2={px(t)} y2={VB.h - PAD.b} stroke="var(--ret-grid)" strokeWidth={1} />
						<text x={px(t)} y={VB.h - PAD.b + 16} textAnchor="middle" className="fill-[var(--ret-text-muted)] font-mono text-[10px]">
							{t}
						</text>
					</g>
				))}
				{/* axis titles */}
				<text x={PAD.l + plotW / 2} y={VB.h - 4} textAnchor="middle" className="fill-[var(--ret-text-dim)] font-mono text-[10px] uppercase">
					latency (ms)
				</text>
				<text
					x={14}
					y={PAD.t + plotH / 2}
					textAnchor="middle"
					transform={`rotate(-90 14 ${PAD.t + plotH / 2})`}
					className="fill-[var(--ret-text-dim)] font-mono text-[10px] uppercase"
				>
					error budget (%)
				</text>

				{/* clickable background for brush */}
				<rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent" onPointerDown={onBgDown} />

				{/* brush rectangle */}
				{brush ? (
					<rect
						x={Math.min(brush.x0, brush.x1)}
						y={Math.min(brush.y0, brush.y1)}
						width={Math.abs(brush.x1 - brush.x0)}
						height={Math.abs(brush.y1 - brush.y0)}
						fill="var(--ret-accent-glow)"
						stroke="var(--ret-border-strong)"
						strokeDasharray="3,3"
						strokeWidth={1}
					/>
				) : null}

				{/* points */}
				{state.agents.map((a) => (
					<ScatterPoint
						key={a.id}
						agent={a}
						cx={px(a.latencyMs)}
						cy={py(a.errorBudget.remainingPct)}
						selected={state.selectedId === a.id}
						onSelect={() => select(a.id)}
						onOpen={() => open(a.id)}
					/>
				))}
			</svg>
		</div>
	);
}

function ScatterPoint({
	agent,
	cx,
	cy,
	selected,
	onSelect,
	onOpen,
}: {
	agent: SreAgent;
	cx: number;
	cy: number;
	selected: boolean;
	onSelect: () => void;
	onOpen: () => void;
}) {
	const color = STATUS_COLOR_VAR[agent.status];
	return (
		<g
			transform={`translate(${cx} ${cy})`}
			className="cursor-pointer"
			onPointerDown={(e) => {
				e.stopPropagation();
				onSelect();
			}}
			onDoubleClick={onOpen}
		>
			{selected ? <circle r={9} fill="none" stroke="var(--ret-border-strong)" strokeWidth={1} /> : null}
			<circle r={selected ? 5.5 : 4.5} fill={color} fillOpacity={agent.status === "idle" ? 0.4 : 0.9} />
			<text x={8} y={3} className="fill-[var(--ret-text-dim)] font-mono text-[10px]">
				{agent.name}
			</text>
		</g>
	);
}
