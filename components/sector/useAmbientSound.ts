"use client";

import { useEffect, useRef } from "react";

import { STATUS_RANK, WORLD, zones, type AgentStatus } from "@/lib/sre-data";
import { TIER_RANK } from "@/lib/promotion";

import { useLens } from "./LensProvider";

// Native Web Audio sonifier. OFF by default; the AudioContext is created/resumed
// only when sound is enabled (the toggle click is the user gesture). Primary
// signal = discrete panned earcons on status transitions — never the sole
// channel. A very low ambient drone tracks aggregate fleet health.
function playEarcon(ctx: AudioContext, master: GainNode, freqs: number[], pan: number, dur = 0.18) {
	const t0 = ctx.currentTime;
	const panner = ctx.createStereoPanner();
	panner.pan.value = Math.max(-1, Math.min(1, pan));
	panner.connect(master);
	freqs.forEach((f, i) => {
		const osc = ctx.createOscillator();
		osc.type = "triangle";
		osc.frequency.value = f;
		const g = ctx.createGain();
		const start = t0 + i * dur * 0.85;
		g.gain.setValueAtTime(0.0001, start);
		g.gain.linearRampToValueAtTime(0.16, start + 0.012);
		g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
		osc.connect(g);
		g.connect(panner);
		osc.start(start);
		osc.stop(start + dur + 0.03);
	});
}

export function useAmbientSound() {
	const { state, worstStatus } = useLens();
	const soundOn = state.soundOn;
	const agents = state.agents;

	const ctxRef = useRef<AudioContext | null>(null);
	const masterRef = useRef<GainNode | null>(null);
	const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
	const prevStatus = useRef<Map<string, AgentStatus>>(new Map());
	const lastEarcon = useRef(0);
	const prevPromoting = useRef<string | null>(null);
	const prevDemoting = useRef<string | null>(null);

	// Enable / disable the audio graph.
	useEffect(() => {
		if (!soundOn) {
			if (ctxRef.current) {
				try {
					ctxRef.current.close();
				} catch {
					/* ignore */
				}
			}
			ctxRef.current = null;
			masterRef.current = null;
			droneRef.current = null;
			return;
		}
		const AC: typeof AudioContext | undefined =
			window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AC) return;
		const ctx = new AC();
		ctxRef.current = ctx;
		const master = ctx.createGain();
		master.gain.value = 0.5;
		master.connect(ctx.destination);
		masterRef.current = master;
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = 55;
		const g = ctx.createGain();
		g.gain.value = 0.0;
		osc.connect(g);
		g.connect(master);
		osc.start();
		droneRef.current = { osc, gain: g };
		void ctx.resume?.();
		// seed so we never earcon the initial snapshot
		const m = new Map<string, AgentStatus>();
		for (const a of agents) m.set(a.id, a.status);
		prevStatus.current = m;
		return () => {
			try {
				osc.stop();
			} catch {
				/* ignore */
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [soundOn]);

	// Drone gain tracks aggregate health.
	useEffect(() => {
		const d = droneRef.current;
		const ctx = ctxRef.current;
		if (!d || !ctx) return;
		const target = worstStatus === "critical" ? 0.022 : worstStatus === "degraded" ? 0.012 : 0.006;
		d.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
	}, [worstStatus]);

	// Earcons on per-agent status transitions.
	useEffect(() => {
		const ctx = ctxRef.current;
		const master = masterRef.current;
		if (!soundOn || !ctx || !master) return;
		const now = performance.now();
		for (const a of agents) {
			const prev = prevStatus.current.get(a.id);
			if (prev && prev !== a.status) {
				const worse = STATUS_RANK[a.status] > STATUS_RANK[prev];
				const notable =
					a.status === "critical" || a.status === "degraded" || prev === "critical" || prev === "degraded";
				if (notable && now - lastEarcon.current > 350) {
					lastEarcon.current = now;
					const z = zones.find((zz) => zz.id === a.zone);
					const cx = z ? z.rect.x + z.rect.w / 2 : WORLD.width / 2;
					const pan = (cx / WORLD.width) * 2 - 1;
					if (worse) playEarcon(ctx, master, [330, 247], pan);
					else playEarcon(ctx, master, [392, 523, 659], pan);
				}
			}
			prevStatus.current.set(a.id, a.status);
		}
	}, [agents, soundOn]);

	// Promotion (rising) / demotion (falling) earcons, panned by autonomy tier.
	useEffect(() => {
		const ctx = ctxRef.current;
		const master = masterRef.current;
		const panFor = (id: string | null) => {
			const a = id ? agents.find((x) => x.id === id) : null;
			return a ? (TIER_RANK[a.autonomyTier] / 3) * 2 - 1 : 0;
		};
		if (soundOn && ctx && master) {
			if (state.promotingId && state.promotingId !== prevPromoting.current) {
				playEarcon(ctx, master, [392, 523, 659], panFor(state.promotingId), 0.2);
			}
			if (state.demotingId && state.demotingId !== prevDemoting.current) {
				playEarcon(ctx, master, [330, 247], panFor(state.demotingId), 0.2);
			}
		}
		prevPromoting.current = state.promotingId;
		prevDemoting.current = state.demotingId;
	}, [state.promotingId, state.demotingId, soundOn, agents]);
}
