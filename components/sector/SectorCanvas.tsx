"use client";

import { Minus, Plus, Scan } from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	type RefObject,
} from "react";

import { cn } from "@/lib/cn";
import {
	CARD_H,
	CARD_W,
	CELL,
	WORLD,
	zones,
	type SreAgent,
} from "@/lib/sre-data";

import { AgentCard } from "./AgentCard";
import { HealthRing } from "./HealthRing";
import { useLens } from "./LensProvider";
import { snapToFreeCell } from "./spatial";
import { TemperatureField } from "./TemperatureField";
import { severity } from "./visual";
import { ZoneField } from "./ZoneField";

const MIN_SCALE = 0.32;
const MAX_SCALE = 1.6;
const L2_THRESHOLD = 0.78;
const PAD = 72;
const OVER = 160;

type Cam = { scale: number; tx: number; ty: number };

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

function prefersReducedMotion() {
	if (typeof window === "undefined") return false;
	return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const center = (a: SreAgent) => ({ x: a.pos.x + CARD_W / 2, y: a.pos.y + CARD_H / 2 });

export function SectorCanvas({ className }: { className?: string }) {
	const { state, select, open, focusZone, moveAgent } = useLens();
	const { agents, selectedId, focusZone: focusZoneId, focusNonce } = state;
	const focusZoneIdRef = useRef(focusZoneId);
	focusZoneIdRef.current = focusZoneId;

	const containerRef = useRef<HTMLDivElement>(null);
	const worldRef = useRef<HTMLDivElement>(null);
	const camRef = useRef<Cam>({ scale: 0.5, tx: 0, ty: 0 });
	const vpRef = useRef({ w: 1200, h: 760 });
	const animRef = useRef<number | null>(null);
	const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const pointer = useRef<{
		mode: "none" | "pan" | "drag";
		id: string | null;
		startX: number;
		startY: number;
		origX: number;
		origY: number;
		panTx: number;
		panTy: number;
		moved: boolean;
	}>({ mode: "none", id: null, startX: 0, startY: 0, origX: 0, origY: 0, panTx: 0, panTy: 0, moved: false });
	const lastClick = useRef<{ id: string | null; t: number }>({ id: null, t: 0 });

	const [level, setLevel] = useState<"L1" | "L2">("L1");

	const applyTransform = useCallback(() => {
		const w = worldRef.current;
		if (!w) return;
		const { scale, tx, ty } = camRef.current;
		w.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
	}, []);

	const clampPan = useCallback((tx: number, ty: number, scale: number): { tx: number; ty: number } => {
		const { w: vw, h: vh } = vpRef.current;
		const worldW = WORLD.width * scale;
		const worldH = WORLD.height * scale;
		const ax = [vw - worldW - OVER, OVER];
		const ay = [vh - worldH - OVER, OVER];
		return {
			tx: clamp(tx, Math.min(ax[0], ax[1]), Math.max(ax[0], ax[1])),
			ty: clamp(ty, Math.min(ay[0], ay[1]), Math.max(ay[0], ay[1])),
		};
	}, []);

	const updateLevel = useCallback((scale: number) => {
		setLevel(scale >= L2_THRESHOLD ? "L2" : "L1");
	}, []);

	const animateTo = useCallback(
		(target: Cam, instant = false) => {
			const clamped = clampPan(target.tx, target.ty, target.scale);
			const dest: Cam = { scale: target.scale, tx: clamped.tx, ty: clamped.ty };
			if (animRef.current != null) cancelAnimationFrame(animRef.current);
			if (instant || prefersReducedMotion()) {
				camRef.current = dest;
				applyTransform();
				updateLevel(dest.scale);
				return;
			}
			const from = { ...camRef.current };
			const dur = 420;
			let start: number | null = null;
			const ease = (t: number) => 1 - Math.pow(1 - t, 3);
			const tick = (ts: number) => {
				if (start == null) start = ts;
				const p = clamp((ts - start) / dur, 0, 1);
				const e = ease(p);
				camRef.current = {
					scale: from.scale + (dest.scale - from.scale) * e,
					tx: from.tx + (dest.tx - from.tx) * e,
					ty: from.ty + (dest.ty - from.ty) * e,
				};
				applyTransform();
				if (p < 1) {
					animRef.current = requestAnimationFrame(tick);
				} else {
					camRef.current = dest;
					applyTransform();
					updateLevel(dest.scale);
					animRef.current = null;
				}
			};
			updateLevel(dest.scale);
			animRef.current = requestAnimationFrame(tick);
		},
		[applyTransform, clampPan, updateLevel],
	);

	const fitAll = useCallback(
		(instant = false) => {
			const { w: vw, h: vh } = vpRef.current;
			const scale = clamp(Math.min((vw - PAD * 2) / WORLD.width, (vh - PAD * 2) / WORLD.height), MIN_SCALE, MAX_SCALE);
			const tx = (vw - WORLD.width * scale) / 2;
			const ty = (vh - WORLD.height * scale) / 2;
			animateTo({ scale, tx, ty }, instant);
		},
		[animateTo],
	);

	const focusRect = useCallback(
		(rect: { x: number; y: number; w: number; h: number }, instant = false) => {
			const { w: vw, h: vh } = vpRef.current;
			const fit = Math.min((vw - PAD * 2) / rect.w, (vh - PAD * 2) / rect.h);
			const scale = clamp(Math.min(fit, 1.12), L2_THRESHOLD, MAX_SCALE);
			const cx = rect.x + rect.w / 2;
			const cy = rect.y + rect.h / 2;
			const tx = vw / 2 - cx * scale;
			const ty = vh / 2 - cy * scale;
			animateTo({ scale, tx, ty }, instant);
		},
		[animateTo],
	);

	const panToWorldPoint = useCallback(
		(wx: number, wy: number) => {
			const { w: vw, h: vh } = vpRef.current;
			const { scale } = camRef.current;
			animateTo({ scale, tx: vw / 2 - wx * scale, ty: vh / 2 - wy * scale });
		},
		[animateTo],
	);

	// Measure viewport + initial fit.
	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const r = el.getBoundingClientRect();
			vpRef.current = { w: r.width, h: r.height };
		};
		measure();
		fitAll(true);
		const ro = new ResizeObserver(() => {
			measure();
			const fz = focusZoneIdRef.current;
			if (fz) {
				const z = zones.find((zz) => zz.id === fz);
				if (z) focusRect(z.rect, true);
				else fitAll(true);
			} else {
				fitAll(true);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// React to focus-zone intent (from zone clicks / ledger / commands).
	const firstFocus = useRef(true);
	useEffect(() => {
		if (firstFocus.current) {
			firstFocus.current = false;
			return;
		}
		if (focusZoneId) {
			const z = zones.find((zz) => zz.id === focusZoneId);
			if (z) focusRect(z.rect);
		} else {
			fitAll();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [focusZoneId, focusNonce]);

	// Native wheel listener (passive:false so we can preventDefault to zoom).
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (animRef.current != null) {
				cancelAnimationFrame(animRef.current);
				animRef.current = null;
			}
			const rect = el.getBoundingClientRect();
			const px = e.clientX - rect.left;
			const py = e.clientY - rect.top;
			const cam = camRef.current;
			const ns = clamp(cam.scale * Math.exp(-e.deltaY * 0.0014), MIN_SCALE, MAX_SCALE);
			const wx = (px - cam.tx) / cam.scale;
			const wy = (py - cam.ty) / cam.scale;
			const { tx, ty } = clampPan(px - wx * ns, py - wy * ns, ns);
			camRef.current = { scale: ns, tx, ty };
			applyTransform();
			updateLevel(ns);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [applyTransform, clampPan, updateLevel]);

	// Select + frame an agent referenced by URL hash (#sre-xxxx) from Cmd+K.
	useEffect(() => {
		const id = window.location.hash.replace(/^#/, "");
		if (!id) return;
		const a = agents.find((x) => x.id === id);
		if (a) {
			select(a.id);
			focusZone(a.zone);
			window.requestAnimationFrame(() => cellRefs.current.get(a.id)?.focus());
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---- Pointer: pan (background) / drag (card) / click (select) ----------
	const onPointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const target = e.target as Element;
			const cell = target.closest<HTMLElement>("[data-agent-id]");
			containerRef.current?.setPointerCapture(e.pointerId);
			if (animRef.current != null) {
				cancelAnimationFrame(animRef.current);
				animRef.current = null;
			}
			if (cell) {
				const id = cell.getAttribute("data-agent-id")!;
				const a = agents.find((x) => x.id === id);
				pointer.current = {
					mode: "drag",
					id,
					startX: e.clientX,
					startY: e.clientY,
					origX: a?.pos.x ?? 0,
					origY: a?.pos.y ?? 0,
					panTx: 0,
					panTy: 0,
					moved: false,
				};
			} else {
				const cam = camRef.current;
				pointer.current = {
					mode: "pan",
					id: null,
					startX: e.clientX,
					startY: e.clientY,
					origX: 0,
					origY: 0,
					panTx: cam.tx,
					panTy: cam.ty,
					moved: false,
				};
			}
		},
		[agents],
	);

	const onPointerMove = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const p = pointer.current;
			if (p.mode === "none") return;
			const dx = e.clientX - p.startX;
			const dy = e.clientY - p.startY;
			if (!p.moved && Math.hypot(dx, dy) > 4) p.moved = true;
			if (p.mode === "pan") {
				const { tx, ty } = clampPan(p.panTx + dx, p.panTy + dy, camRef.current.scale);
				camRef.current = { ...camRef.current, tx, ty };
				applyTransform();
			} else if (p.mode === "drag" && p.id) {
				const scale = camRef.current.scale;
				const nx = clamp(p.origX + dx / scale, 0, WORLD.width - CARD_W);
				const ny = clamp(p.origY + dy / scale, 0, WORLD.height - CARD_H);
				const el = cellRefs.current.get(p.id);
				if (el) {
					el.style.left = `${nx}px`;
					el.style.top = `${ny}px`;
				}
			}
		},
		[applyTransform, clampPan],
	);

	const onPointerUp = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			const p = pointer.current;
			pointer.current = { ...p, mode: "none" };
			try {
				containerRef.current?.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			if (!p.moved) {
				// click — pointer capture rewrites e.target to the container, so
				// hit-test at the actual coordinates instead.
				if (p.mode === "drag" && p.id) {
					// second click on the same card within 350ms opens its dossier
					const now = performance.now();
					if (lastClick.current.id === p.id && now - lastClick.current.t < 350) {
						open(p.id);
						lastClick.current = { id: null, t: 0 };
					} else {
						select(p.id);
						lastClick.current = { id: p.id, t: now };
					}
				} else {
					const at = document.elementFromPoint(e.clientX, e.clientY);
					const zone = at?.closest<HTMLElement>("[data-zone-id]");
					if (zone) focusZone(zone.getAttribute("data-zone-id") as SreAgent["zone"]);
					else select(null);
				}
				return;
			}
			if (p.mode === "drag" && p.id) {
				// drop: magnetic snap to the nearest free 48px cell (no overlap)
				const scale = camRef.current.scale;
				const dx = e.clientX - p.startX;
				const dy = e.clientY - p.startY;
				const { x, y } = snapToFreeCell(agents, p.id, p.origX + dx / scale, p.origY + dy / scale);
				moveAgent(p.id, x, y);
			}
		},
		[agents, focusZone, moveAgent, open, select],
	);

	const onCellKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLDivElement>, agent: SreAgent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				open(agent.id);
				return;
			}
			const dirs: Record<string, "left" | "right" | "up" | "down"> = {
				ArrowLeft: "left",
				ArrowRight: "right",
				ArrowUp: "up",
				ArrowDown: "down",
			};
			const dir = dirs[e.key];
			if (!dir) return;
			e.preventDefault();
			// Shift+Arrow MOVES the agent one cell (keyboard regroup — re-zones +
			// re-clusters via the reducer). Plain Arrow moves focus (below).
			if (e.shiftKey) {
				const dxCell = dir === "left" ? -CELL : dir === "right" ? CELL : 0;
				const dyCell = dir === "up" ? -CELL : dir === "down" ? CELL : 0;
				const nx = clamp(agent.pos.x + dxCell, 0, WORLD.width - CARD_W);
				const ny = clamp(agent.pos.y + dyCell, 0, WORLD.height - CARD_H);
				moveAgent(agent.id, nx, ny);
				const cx = nx + CARD_W / 2;
				const cy = ny + CARD_H / 2;
				const cam = camRef.current;
				const sx = cx * cam.scale + cam.tx;
				const sy = cy * cam.scale + cam.ty;
				const { w: vw, h: vh } = vpRef.current;
				if (sx < PAD || sx > vw - PAD || sy < PAD || sy > vh - PAD) panToWorldPoint(cx, cy);
				return;
			}
			const from = center(agent);
			let best: SreAgent | null = null;
			let bestScore = Infinity;
			for (const a of agents) {
				if (a.id === agent.id) continue;
				const c = center(a);
				const dx = c.x - from.x;
				const dy = c.y - from.y;
				const inDir = dir === "left" ? dx < -1 : dir === "right" ? dx > 1 : dir === "up" ? dy < -1 : dy > 1;
				if (!inDir) continue;
				const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
				const perp = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
				const score = along + perp * 2;
				if (score < bestScore) {
					bestScore = score;
					best = a;
				}
			}
			if (best) {
				select(best.id);
				cellRefs.current.get(best.id)?.focus();
				const c = center(best);
				const cam = camRef.current;
				const sx = c.x * cam.scale + cam.tx;
				const sy = c.y * cam.scale + cam.ty;
				const { w: vw, h: vh } = vpRef.current;
				if (sx < PAD || sx > vw - PAD || sy < PAD || sy > vh - PAD) panToWorldPoint(c.x, c.y);
			}
		},
		[agents, moveAgent, open, panToWorldPoint, select],
	);

	return (
		<div
			className={cn(
				"ret-sector relative h-full w-full touch-none select-none overflow-hidden bg-[var(--ret-bg)]",
				className,
			)}
			data-level={level}
		>
			<div
				ref={containerRef}
				className="absolute inset-0 cursor-grab active:cursor-grabbing"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				role="application"
				aria-label="Sector canvas — spatial fleet board. Use the list view for full keyboard and screen-reader access."
			>
				<div
					ref={worldRef}
					className="ret-blueprint absolute left-0 top-0 origin-top-left"
					style={{
						width: WORLD.width,
						height: WORLD.height,
						backgroundImage: "radial-gradient(var(--ret-grid) 1px, transparent 1px)",
						backgroundSize: `${CELL}px ${CELL}px`,
					}}
				>
					{zones.map((z) => (
						<ZoneField
							key={z.id}
							zone={z}
							agents={agents.filter((a) => a.zone === z.id)}
							focused={focusZoneId === z.id}
						/>
					))}

					{agents.map((agent) => {
						const selected = selectedId === agent.id;
						return (
							<div
								key={agent.id}
								data-agent-id={agent.id}
								data-sev={severity(agent.status)}
								ref={(el) => {
									if (el) cellRefs.current.set(agent.id, el);
									else cellRefs.current.delete(agent.id);
								}}
								role="button"
								tabIndex={0}
								aria-pressed={selected}
								aria-label={`${agent.name}, ${agent.status}, ${agent.zone} zone, ${agent.region}, ${agent.uptime}. Enter to open dossier; arrow keys to navigate; Shift plus arrow keys to move the agent.`}
								onKeyDown={(e) => onCellKeyDown(e, agent)}
								className={cn(
									"ret-cell absolute outline-none transition-shadow",
									"focus-visible:ring-2 focus-visible:ring-[var(--ret-accent)]",
								)}
								style={{ left: agent.pos.x, top: agent.pos.y, width: CARD_W, height: CARD_H }}
							>
								<AgentCard agent={agent} level={level} selected={selected} />
							</div>
						);
					})}
				</div>
				<TemperatureField />
				<HealthRing />
			</div>

			{/* zoom controls */}
			<div className="absolute bottom-3 right-3 z-20 flex flex-col border border-[var(--ret-border)] bg-[var(--ret-bg)]/90 backdrop-blur-sm">
				<ZoomBtn label="Zoom in" onClick={() => zoomAround(camRef, vpRef, 1.25, applyTransform, clampPan, updateLevel)}>
					<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
				</ZoomBtn>
				<ZoomBtn label="Zoom out" onClick={() => zoomAround(camRef, vpRef, 0.8, applyTransform, clampPan, updateLevel)}>
					<Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
				</ZoomBtn>
				<ZoomBtn
					label="Fit board"
					onClick={() => {
						focusZone(null);
						fitAll();
					}}
				>
					<Scan className="h-3.5 w-3.5" strokeWidth={1.75} />
				</ZoomBtn>
			</div>

			{/* level indicator */}
			<div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 font-mono text-[10px] text-[var(--ret-text-muted)]">
				<span className="border border-[var(--ret-border)] bg-[var(--ret-bg)]/80 px-1.5 py-0.5">
					{level === "L1" ? "L1 · SECTOR" : "L2 · ZONE"}
				</span>
				<span className="hidden sm:inline">scroll to zoom · drag a card to regroup</span>
			</div>
		</div>
	);
}

function zoomAround(
	camRef: RefObject<Cam>,
	vpRef: RefObject<{ w: number; h: number }>,
	factor: number,
	apply: () => void,
	clampPan: (tx: number, ty: number, scale: number) => { tx: number; ty: number },
	updateLevel: (s: number) => void,
) {
	const cam = camRef.current;
	const { w: vw, h: vh } = vpRef.current;
	const ns = clamp(cam.scale * factor, MIN_SCALE, MAX_SCALE);
	const wx = (vw / 2 - cam.tx) / cam.scale;
	const wy = (vh / 2 - cam.ty) / cam.scale;
	const { tx, ty } = clampPan(vw / 2 - wx * ns, vh / 2 - wy * ns, ns);
	camRef.current = { scale: ns, tx, ty };
	apply();
	updateLevel(ns);
}

function ZoomBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="flex h-8 w-8 items-center justify-center border-b border-[var(--ret-border)] text-[var(--ret-text-dim)] transition-colors last:border-b-0 hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]"
		>
			{children}
		</button>
	);
}
