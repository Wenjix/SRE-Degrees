"use client";

import { useEffect, useRef } from "react";

import type { AgentStatus } from "@/lib/sre-data";
import type { WorldNode } from "@/lib/world";

const STATUS_VAR: Record<AgentStatus, string> = {
	healthy: "--ret-green",
	degraded: "--ret-amber",
	critical: "--ret-red",
	idle: "--ret-text-muted",
};

// Hand-rolled canvas globe. Points live on a unit sphere (lat/lon); each frame
// rotates around the Y axis, projects to 2D, depth-sorts, and draws. Rotation is
// a view-local rAF loop (NOT a store timer); reduced-motion renders one frame.
export function WorldGlobe({
	nodes,
	focusIds,
	selectedId,
	onPick,
}: {
	nodes: WorldNode[];
	focusIds: Set<string>;
	selectedId: string | null;
	onPick: (agentId: string) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hitsRef = useRef<{ agentId: string; x: number; y: number; z: number }[]>([]);
	// keep latest props for the animation loop without re-subscribing
	const stateRef = useRef({ nodes, focusIds, selectedId });
	stateRef.current = { nodes, focusIds, selectedId };

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const root = document.documentElement;
		const cssVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim() || "#888";
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let raf = 0;
		let angle = 0;
		let w = 0;
		let h = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);

		const draw = () => {
			const { nodes: ns, focusIds: focus, selectedId: sel } = stateRef.current;
			const cx = w * 0.5;
			const cy = h * 0.5;
			const R = Math.min(w, h) * 0.42;
			const colors: Record<AgentStatus, string> = {
				healthy: cssVar(STATUS_VAR.healthy),
				degraded: cssVar(STATUS_VAR.degraded),
				critical: cssVar(STATUS_VAR.critical),
				idle: cssVar(STATUS_VAR.idle),
			};
			const accent = cssVar("--ret-accent");
			const text = cssVar("--ret-text");
			const dim = cssVar("--ret-text-dim");
			ctx.clearRect(0, 0, w, h);

			const sin = Math.sin(angle);
			const cos = Math.cos(angle);
			const active = focus.size > 0;
			const projected = ns.map((n) => {
				const cl = Math.cos(n.lat);
				const x0 = cl * Math.sin(n.lon);
				const y0 = Math.sin(n.lat);
				const z0 = cl * Math.cos(n.lon);
				const x = x0 * cos + z0 * sin;
				const z = -x0 * sin + z0 * cos;
				return { n, x: cx + x * R, y: cy - y0 * R, z };
			});
			projected.sort((a, b) => a.z - b.z);

			const hits: typeof hitsRef.current = [];
			for (const p of projected) {
				const depth = (p.z + 1) / 2;
				const isFocus = active && p.n.agentId != null && focus.has(p.n.agentId);
				const dim2 = active && !isFocus && !p.n.anchor;
				if (p.n.anchor) {
					const r = 4.5 + depth * 2.5;
					ctx.globalAlpha = 0.3 + depth * 0.7;
					ctx.fillStyle = colors[p.n.status];
					ctx.beginPath();
					ctx.arc(p.x, p.y, r, 0, 7);
					ctx.fill();
					if (p.n.agentId === sel || isFocus) {
						ctx.globalAlpha = 1;
						ctx.strokeStyle = accent;
						ctx.lineWidth = p.n.agentId === sel ? 2.5 : 1.5;
						ctx.beginPath();
						ctx.arc(p.x, p.y, r + 4, 0, 7);
						ctx.stroke();
					}
					// billboard label only when facing the viewer
					if (p.z > 0.1) {
						ctx.globalAlpha = 0.4 + depth * 0.6;
						ctx.fillStyle = isFocus || p.n.agentId === sel ? text : dim;
						ctx.font = "11px ui-monospace, monospace";
						ctx.fillText(p.n.id.replace(/^(agent|svc):/, ""), p.x + r + 4, p.y + 3);
					}
					if (p.n.agentId && p.z > -0.2) hits.push({ agentId: p.n.agentId, x: p.x, y: p.y, z: p.z });
				} else {
					ctx.globalAlpha = (dim2 ? 0.06 : 0.16) + depth * (dim2 ? 0.06 : 0.5);
					ctx.fillStyle = colors[p.n.status];
					ctx.beginPath();
					ctx.arc(p.x, p.y, 0.6 + depth * 1.6, 0, 7);
					ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
			hitsRef.current = hits;
		};

		const loop = () => {
			angle += 0.0016;
			draw();
			raf = requestAnimationFrame(loop);
		};
		if (reduce) draw();
		else raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	}, []);

	const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const py = e.clientY - rect.top;
		let best: { agentId: string; d: number } | null = null;
		for (const hit of hitsRef.current) {
			const d = Math.hypot(hit.x - px, hit.y - py);
			if (d < 16 && (!best || d < best.d)) best = { agentId: hit.agentId, d };
		}
		if (best) onPick(best.agentId);
	};

	return <canvas ref={canvasRef} onClick={handleClick} className="h-full w-full cursor-pointer" aria-label="Production world model globe" />;
}
