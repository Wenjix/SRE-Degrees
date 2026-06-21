"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	type ReactNode,
} from "react";

import {
	agents as seedAgents,
	CELL,
	MS_PER_HOUR,
	STATUS_RANK,
	toneForStatus,
	WORLD,
	zones,
	incidentsSeed,
	pendingActionsSeed,
	type AgentStatus,
	type AutonomyTier,
	type Incident,
	type PendingAction,
	type ProvingEnv,
	type SreAgent,
	type Tier,
} from "@/lib/sre-data";
import { computeReadiness, eligible, nextTier, prevTier, TIER_RANK } from "@/lib/promotion";

export type ViewMode = "canvas" | "list" | "scatter" | "promote" | "cockpit" | "incidents" | "queue" | "fleet" | "blast" | "world";

export type LedgerEntry = {
	ts: number;
	agentId: string;
	agentName: string;
	fromTier: AutonomyTier;
	toTier: AutonomyTier;
	actor: "operator" | "auto";
	reason: string;
};

export type LensState = {
	agents: SreAgent[];
	selectedId: string | null;
	openAgentId: string | null; // L3 dossier
	activeView: ViewMode;
	focusZone: Tier | null; // intent: canvas should frame this zone
	focusNonce: number; // bump to re-fire focus even for same zone
	soundOn: boolean;
	groupNames: Record<string, string>; // sticky cluster rename: key -> name
	// --- promotion engine ---
	promoteSelectedId: string | null; // docked candidate in the PROMOTE lens
	promotingId: string | null; // transient: a promotion ceremony in flight
	demotingId: string | null; // transient: a demotion ceremony in flight
	ledger: LedgerEntry[];
	// --- on-call cockpit ---
	incidents: Incident[];
	pendingActions: PendingAction[];
	// --- undo toast ---
	toast: { token: number; label: string; restore: PendingAction | null } | null;
};

// monotonic token for toast deduplication
let _toastToken = 0;

type Action =
	| { type: "SET_VIEW"; view: ViewMode }
	| { type: "SELECT"; id: string | null }
	| { type: "OPEN"; id: string }
	| { type: "CLOSE" }
	| { type: "FOCUS_ZONE"; zone: Tier | null }
	| { type: "MOVE_AGENT"; id: string; x: number; y: number }
	| { type: "TICK" }
	| { type: "TOGGLE_SOUND" }
	| { type: "SET_SOUND"; on: boolean }
	| { type: "RENAME_GROUP"; key: string; name: string }
	| { type: "SELECT_CANDIDATE"; id: string | null }
	| { type: "PROMOTE"; id: string }
	| { type: "ROLLBACK"; id: string }
	| { type: "HOLD"; id: string }
	| { type: "CLEAR_CEREMONY" }
	| { type: "RESOLVE_ACTION"; id: string; decision: "approve" | "deny" | "escalate" }
	| { type: "ACKNOWLEDGE_INCIDENT"; id: string }
	| { type: "ASSIGN_COMMANDER"; id: string }
	| { type: "RESOLVE_INCIDENT"; id: string }
	| { type: "UNDO_TOAST" }
	| { type: "DISMISS_TOAST" };

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

// One simulated telemetry step. Runs client-side only (inside an effect), so
// Math.random here never affects SSR/first-paint determinism.
function stepTelemetry(list: SreAgent[]): SreAgent[] {
	return list.map((a) => {
		// idle agents are a static pool — freeze their reference so memo'd cards
		// stop re-rendering every tick (idle CPU shouldn't drift anyway).
		if (a.status === "idle") return a;
		const drift = (m: { current: number; unit: string; series: number[] }, jitter: number, lo: number, hi: number) => {
			const next = clamp(m.current + (Math.random() - 0.5) * jitter, lo, hi);
			const series = [...m.series.slice(1), Math.round(next * 100) / 100];
			return { ...m, current: Math.round(next * 100) / 100, series };
		};

		// (idle agents already returned above)
		const cpu = drift(a.cpu, 0.14, 0.02, 1);
		const mem = drift(a.mem, 24, 16, 512);
		const disk = drift(a.disk, 0.05, 0.2, 8);

		// occasional status flap on non-critical, non-idle agents to exercise
		// the sensory + sonifier transition layer (Atlas stays the anchored fire)
		let status: AgentStatus = a.status;
		// rare single-tick health blips keep the board alive without destabilizing
		// promotion eligibility: a degraded blip ALWAYS recovers the next tick, and
		// only healthy agents (not Atlas, the anchored fire) occasionally blip.
		// PROVEN agents (readiness >= 85) hold steady — trust earned doesn't wobble,
		// so a just-promoted/just-recovered candidate stays eligible on cue.
		if (a.id !== "sre-7f2a" && a.readiness < 85) {
			if (a.status === "degraded") status = "healthy";
			else if (Math.random() < 0.04) status = "degraded";
		}

		const burnRate =
			status === "critical" ? a.slo.burnRate : status === "degraded" ? clamp(1 + Math.random(), 1, 2.4) : clamp(a.slo.burnRate * 0.9, 0.2, 0.95);
		const remainingPct = clamp(
			a.errorBudget.remainingPct + (status === "critical" ? -0.6 : status === "degraded" ? -0.2 : 0.3),
			0,
			100,
		);

		const ticks = [...a.heartbeat.ticks.slice(1), Math.round((1 + (Math.random() - 0.5) * 0.3) * 1000) / 1000];

		// --- agent-native work signals + cost drift like vitals ---
		const actions = drift(a.actions, Math.max(2, a.actions.current * 0.18), 0, 600);
		const toolSuccess = drift(a.toolSuccess, 0.4, 80, 100);
		const decisionMs = drift(a.decisionMs, Math.max(8, a.decisionMs.current * 0.15), 20, 4000);
		const cost = drift(a.cost, Math.max(0.3, a.cost.current * 0.12), 0.2, 200);

		// the OWNED service's budget is independent of agent health: it DRAINS while
		// the service burns (burnRate stays a stable narrative value) and recovers
		// otherwise — so a healthy agent can sit over a service bleeding to zero.
		const svcBudget = clamp(
			a.service.errorBudgetPct + (a.service.burnRate > 1 ? -(a.service.burnRate - 1) * 0.4 : 0.25),
			0,
			100,
		);
		const service = { ...a.service, errorBudgetPct: Math.round(svcBudget) };

		// decision quality drifts toward a status-based target; agreement jitters
		const evalTarget = status === "critical" ? 0.86 : status === "degraded" ? 0.97 : Math.max(a.evalPassRate, 0.99);
		const evalPassRate = clamp(a.evalPassRate + (evalTarget - a.evalPassRate) * 0.12 + (Math.random() - 0.5) * 0.0005, 0.7, 0.9999);
		const humanAgreementRate = clamp(a.humanAgreementRate + (Math.random() - 0.5) * 0.002, 0.8, 0.999);

		// --- autonomy / promotion evolution (evidence accrues over time) ---
		const verifiedRuns = a.verifiedRuns + Math.floor(Math.random() * 6) + 2;
		let provingEnv: ProvingEnv = a.provingEnv;
		if (provingEnv === "sandbox" && verifiedRuns >= 40) provingEnv = "shadow";
		if (provingEnv === "shadow" && verifiedRuns >= 200) provingEnv = "canary";
		if (provingEnv === "canary" && verifiedRuns >= 800) provingEnv = "production";

		const srTarget = status === "critical" ? 0.95 : status === "degraded" ? 0.997 : 0.99985;
		const successRate = clamp(a.successRate + (srTarget - a.successRate) * 0.25 + (Math.random() - 0.5) * 0.0001, 0.8, 0.99999);
		// healthy agents recover trust fast (multiplicative decay toward zero);
		// degraded/critical erode it — so trust is earned and lost in the math.
		const overrideRate = clamp(
			status === "healthy"
				? a.overrideRate * 0.9
				: status === "degraded"
					? a.overrideRate + 0.01
					: status === "critical"
						? a.overrideRate + 0.03
						: a.overrideRate * 0.95,
			0,
			0.4,
		);

		const critStreak = status === "critical" ? a.critStreak + 1 : 0;
		const critsInWindow = status === "critical" && a.status !== "critical" ? a.critsInWindow + 1 : a.critsInWindow;
		const soakMs = a.soakMs + 0.5 * MS_PER_HOUR;
		const cooldown = Math.max(0, a.cooldown - 1);

		const draft: SreAgent = {
			...a,
			status,
			tone: toneForStatus(status),
			cpu,
			mem,
			disk,
			actions,
			toolSuccess,
			decisionMs,
			cost,
			service,
			evalPassRate,
			humanAgreementRate,
			slo: { ...a.slo, burnRate: Math.round(burnRate * 10) / 10 },
			errorBudget: { remainingPct: Math.round(remainingPct) },
			heartbeat: { ...a.heartbeat, ticks },
			verifiedRuns,
			provingEnv,
			successRate,
			overrideRate,
			critStreak,
			critsInWindow,
			soakMs,
			cooldown,
		};
		// slew-limit readiness so it visibly creeps rather than snapping with the flap
		const target = computeReadiness(draft);
		const readiness = clamp(a.readiness + clamp(target - a.readiness, -3, 3), 0, 100);
		return { ...draft, readiness };
	});
}

const ENV_BACK: Record<ProvingEnv, ProvingEnv> = {
	sandbox: "sandbox",
	shadow: "sandbox",
	canary: "shadow",
	production: "canary",
};

// Forward one proving ground — a handled incident is live-fire evidence that
// graduates the agent toward production.
const ENV_FWD: Record<ProvingEnv, ProvingEnv> = {
	sandbox: "shadow",
	shadow: "canary",
	canary: "production",
	production: "production",
};

// Apply a tier change (promotion or demotion): reset the soak/incident window,
// snap the proving ground back on demotion, set a cooldown, recompute readiness.
function applyTierChange(a: SreAgent, to: AutonomyTier, demote: boolean): SreAgent {
	const next: SreAgent = {
		...a,
		autonomyTier: to,
		soakMs: 0,
		critsInWindow: 0,
		critStreak: 0,
		cooldown: 5,
		provingEnv: demote ? ENV_BACK[a.provingEnv] : a.provingEnv,
	};
	return { ...next, readiness: computeReadiness(next) };
}

// --- on-call cockpit aging (sim-compressed so durations/SLAs visibly move) ----
const COCKPIT_TICK_MS = 24_000;
function stepIncidents(list: Incident[]): Incident[] {
	return list.map((inc) => {
		const last = inc.burnTrend[inc.burnTrend.length - 1] ?? 1;
		const delta = inc.trend === "worsening" ? 0.08 : inc.trend === "recovering" ? -0.08 : (Math.random() - 0.5) * 0.06;
		const next = Math.max(0.1, Math.round((last + delta) * 10) / 10);
		return { ...inc, ageMs: inc.ageMs + COCKPIT_TICK_MS, burnTrend: [...inc.burnTrend.slice(-11), next] };
	});
}
function agePending(list: PendingAction[]): PendingAction[] {
	return list.map((p) => ({ ...p, ageMs: p.ageMs + 8_000 }));
}

function reducer(state: LensState, action: Action): LensState {
	switch (action.type) {
		case "SET_VIEW":
			return { ...state, activeView: action.view };
		case "SELECT":
			return { ...state, selectedId: action.id };
		case "OPEN":
			return { ...state, openAgentId: action.id, selectedId: action.id };
		case "CLOSE":
			return { ...state, openAgentId: null };
		case "FOCUS_ZONE":
			return { ...state, focusZone: action.zone, focusNonce: state.focusNonce + 1 };
		case "MOVE_AGENT": {
			const zone = zoneAtPoint(action.x + 144, action.y + 120) ?? state.agents.find((a) => a.id === action.id)?.zone;
			return {
				...state,
				agents: state.agents.map((a) =>
					a.id === action.id ? { ...a, pos: { x: action.x, y: action.y }, zone: (zone ?? a.zone) as Tier } : a,
				),
			};
		}
		case "TICK": {
			const agents = stepTelemetry(state.agents);
			const incidents = stepIncidents(state.incidents);
			const pendingActions = agePending(state.pendingActions);
			// auto-demote at most one agent on sustained critical — but only when no
			// ceremony is in flight, and respecting per-agent cooldown (no thrash).
			if (!state.promotingId && !state.demotingId) {
				const victim = agents.find((a) => a.critStreak >= 3 && TIER_RANK[a.autonomyTier] > 0 && a.cooldown === 0);
				const to = victim ? prevTier(victim.autonomyTier) : null;
				if (victim && to) {
					const next = agents.map((a) => (a.id === victim.id ? applyTierChange(a, to, true) : a));
					const vinc = state.incidents.find((i) => !i.resolved && i.agentIds.includes(victim.id));
					const entry: LedgerEntry = {
						ts: Date.now(),
						agentId: victim.id,
						agentName: victim.name,
						fromTier: victim.autonomyTier,
						toTier: to,
						actor: "auto",
						reason: vinc ? `sustained critical · ${vinc.id} — trust revoked` : "sustained critical — trust revoked",
					};
					return { ...state, agents: next, incidents, pendingActions, demotingId: victim.id, ledger: [entry, ...state.ledger].slice(0, 60) };
				}
			}
			return { ...state, agents, incidents, pendingActions };
		}
		case "SELECT_CANDIDATE":
			return { ...state, promoteSelectedId: action.id, selectedId: action.id };
		case "PROMOTE": {
			const a = state.agents.find((x) => x.id === action.id);
			const to = a ? nextTier(a.autonomyTier) : null;
			if (!a || !to || !eligible(a)) return state;
			const entry: LedgerEntry = {
				ts: Date.now(),
				agentId: a.id,
				agentName: a.name,
				fromTier: a.autonomyTier,
				toTier: to,
				actor: "operator",
				reason: to === "autonomous" ? "oversight removed" : "promoted",
			};
			return {
				...state,
				agents: state.agents.map((x) => (x.id === a.id ? applyTierChange(x, to, false) : x)),
				promotingId: a.id,
				ledger: [entry, ...state.ledger].slice(0, 60),
			};
		}
		case "ROLLBACK": {
			const a = state.agents.find((x) => x.id === action.id);
			const to = a ? prevTier(a.autonomyTier) : null;
			if (!a || !to) return state;
			const entry: LedgerEntry = {
				ts: Date.now(),
				agentId: a.id,
				agentName: a.name,
				fromTier: a.autonomyTier,
				toTier: to,
				actor: "operator",
				reason: "manual rollback",
			};
			return {
				...state,
				agents: state.agents.map((x) => (x.id === a.id ? applyTierChange(x, to, true) : x)),
				demotingId: a.id,
				ledger: [entry, ...state.ledger].slice(0, 60),
			};
		}
		case "HOLD": {
			const a = state.agents.find((x) => x.id === action.id);
			if (!a) return state;
			const entry: LedgerEntry = {
				ts: Date.now(),
				agentId: a.id,
				agentName: a.name,
				fromTier: a.autonomyTier,
				toTier: a.autonomyTier,
				actor: "operator",
				reason: "held for review",
			};
			return { ...state, ledger: [entry, ...state.ledger].slice(0, 60) };
		}
		case "CLEAR_CEREMONY":
			return { ...state, promotingId: null, demotingId: null };
		case "RESOLVE_ACTION": {
			const act = state.pendingActions.find((p) => p.id === action.id);
			if (!act) return state;
			const verb = action.decision === "approve" ? "APPROVED" : action.decision === "deny" ? "DENIED" : "ESCALATED";
			const token = ++_toastToken;
			const la = state.agents.find((a) => a.id === act.agentId);
			const lentry: LedgerEntry | null = la
				? { ts: Date.now(), agentId: la.id, agentName: la.name, fromTier: la.autonomyTier, toTier: la.autonomyTier, actor: "operator", reason: `${act.id} ${verb.toLowerCase()} · ${act.action}` }
				: null;
			return {
				...state,
				pendingActions: state.pendingActions.filter((p) => p.id !== action.id),
				agents: state.agents.map((a) =>
					a.id === act.agentId
						? { ...a, terminalLines: [...a.terminalLines.slice(-7), `${act.id} ${act.action} → ${verb} by operator`] }
						: a,
				),
				toast: { token, label: `${act.id} ${verb}`, restore: act },
				ledger: lentry ? [lentry, ...state.ledger].slice(0, 60) : state.ledger,
			};
		}
		case "ACKNOWLEDGE_INCIDENT": {
			const inc = state.incidents.find((i) => i.id === action.id);
			const a = inc ? state.agents.find((x) => x.id === inc.agentIds[0]) : undefined;
			const entry: LedgerEntry | null = inc && a
				? { ts: Date.now(), agentId: a.id, agentName: a.name, fromTier: a.autonomyTier, toTier: a.autonomyTier, actor: "operator", reason: `${inc.id} acknowledged — investigating` }
				: null;
			return {
				...state,
				incidents: state.incidents.map((i) => (i.id === action.id ? { ...i, acknowledged: true } : i)),
				ledger: entry ? [entry, ...state.ledger].slice(0, 60) : state.ledger,
			};
		}
		case "ASSIGN_COMMANDER": {
			return {
				...state,
				incidents: state.incidents.map((inc) =>
					inc.id === action.id && inc.commander === null ? { ...inc, commander: "you" } : inc,
				),
			};
		}
		case "RESOLVE_INCIDENT": {
			const inc = state.incidents.find((i) => i.id === action.id);
			if (!inc || inc.resolved) return state;
			const implicated = new Set(inc.agentIds);
			const adds: LedgerEntry[] = [];
			const agents = state.agents.map((a) => {
				if (!implicated.has(a.id)) return a;
				// the recovered incident IS the proving evidence: it improves the exact
				// metrics the promotion gate measures (service health, proving env,
				// verified runs, decision-quality eval, review coverage).
				const improved: SreAgent = {
					...a,
					service: { ...a.service, burnRate: 0.6, errorBudgetPct: Math.max(a.service.errorBudgetPct, 85) },
					provingEnv: ENV_FWD[a.provingEnv],
					verifiedRuns: Math.max(a.verifiedRuns, 1040),
					evalPassRate: Math.max(a.evalPassRate, 0.996),
					reviewSamplingRate: Math.max(a.reviewSamplingRate, 0.06),
					overrideRate: Math.min(a.overrideRate, 0.004),
					soakMs: Math.max(a.soakMs, 13 * MS_PER_HOUR),
					critsInWindow: 0,
					critStreak: 0,
				};
				adds.push({ ts: Date.now(), agentId: a.id, agentName: a.name, fromTier: a.autonomyTier, toTier: a.autonomyTier, actor: "auto", reason: `live-fire evidence from ${inc.id} — proved ${a.provingEnv}→${improved.provingEnv}` });
				return { ...improved, readiness: computeReadiness(improved) };
			});
			const lead = state.agents.find((a) => implicated.has(a.id));
			const opEntry: LedgerEntry | null = lead
				? { ts: Date.now(), agentId: lead.id, agentName: lead.name, fromTier: lead.autonomyTier, toTier: lead.autonomyTier, actor: "operator", reason: `${inc.id} resolved — ${inc.service} within budget` }
				: null;
			return {
				...state,
				agents,
				incidents: state.incidents.map((i) => (i.id === action.id ? { ...i, resolved: true, acknowledged: true, trend: "recovering" } : i)),
				ledger: [...(opEntry ? [opEntry] : []), ...adds, ...state.ledger].slice(0, 60),
			};
		}
		case "UNDO_TOAST": {
			if (!state.toast?.restore) return { ...state, toast: null };
			return {
				...state,
				pendingActions: [state.toast.restore, ...state.pendingActions],
				toast: null,
			};
		}
		case "DISMISS_TOAST":
			return { ...state, toast: null };
		case "TOGGLE_SOUND":
			return { ...state, soundOn: !state.soundOn };
		case "SET_SOUND":
			return { ...state, soundOn: action.on };
		case "RENAME_GROUP":
			return { ...state, groupNames: { ...state.groupNames, [action.key]: action.name } };
		default:
			return state;
	}
}

// Lightweight zone hit-test mirrors sre-data zones.
function zoneAtPoint(cx: number, cy: number): Tier | null {
	const z = zones.find((zone) => cx >= zone.rect.x && cx <= zone.rect.x + zone.rect.w && cy >= zone.rect.y && cy <= zone.rect.y + zone.rect.h);
	return z ? z.id : null;
}

const SOUND_KEY = "reticle-console.sound";

const LensContext = createContext<LensContextValue | null>(null);

export type LensContextValue = {
	state: LensState;
	setView: (view: ViewMode) => void;
	select: (id: string | null) => void;
	open: (id: string) => void;
	close: () => void;
	focusZone: (zone: Tier | null) => void;
	moveAgent: (id: string, x: number, y: number) => void;
	toggleSound: () => void;
	renameGroup: (key: string, name: string) => void;
	selectCandidate: (id: string | null) => void;
	promote: (id: string) => void;
	rollback: (id: string) => void;
	hold: (id: string) => void;
	clearCeremony: () => void;
	resolveAction: (id: string, decision: "approve" | "deny" | "escalate") => void;
	acknowledgeIncident: (id: string) => void;
	assignCommander: (id: string) => void;
	resolveIncident: (id: string) => void;
	undoToast: () => void;
	dismissToast: () => void;
	worstStatus: AgentStatus;
};

export function LensProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, undefined, (): LensState => ({
		agents: seedAgents,
		selectedId: null,
		openAgentId: null,
		activeView: "canvas",
		focusZone: null,
		focusNonce: 0,
		soundOn: false,
		groupNames: {},
		promoteSelectedId: null,
		promotingId: null,
		demotingId: null,
		ledger: [],
		incidents: incidentsSeed,
		pendingActions: pendingActionsSeed,
		toast: null,
	}));

	// Restore persisted sound preference (off by default).
	useEffect(() => {
		try {
			if (window.localStorage.getItem(SOUND_KEY) === "on") dispatch({ type: "SET_SOUND", on: true });
		} catch {
			/* ignore */
		}
	}, []);

	useEffect(() => {
		try {
			window.localStorage.setItem(SOUND_KEY, state.soundOn ? "on" : "off");
		} catch {
			/* ignore */
		}
	}, [state.soundOn]);

	// Telemetry simulator — ticks while the tab is visible.
	useEffect(() => {
		let id: number | undefined;
		const start = () => {
			if (id == null) id = window.setInterval(() => dispatch({ type: "TICK" }), 1600);
		};
		const stop = () => {
			if (id != null) {
				window.clearInterval(id);
				id = undefined;
			}
		};
		const onVis = () => (document.hidden ? stop() : start());
		start();
		document.addEventListener("visibilitychange", onVis);
		return () => {
			stop();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	const worstStatus = useMemo<AgentStatus>(() => {
		let worst: AgentStatus = "idle";
		for (const a of state.agents) if (STATUS_RANK[a.status] > STATUS_RANK[worst]) worst = a.status;
		return worst;
	}, [state.agents]);

	// Stable action creators (dispatch never changes) so consumers that bind to
	// these callbacks don't re-bind on every telemetry tick.
	const setView = useCallback((view: ViewMode) => dispatch({ type: "SET_VIEW", view }), []);
	const select = useCallback((id: string | null) => dispatch({ type: "SELECT", id }), []);
	const open = useCallback((id: string) => dispatch({ type: "OPEN", id }), []);
	const close = useCallback(() => dispatch({ type: "CLOSE" }), []);
	const focusZone = useCallback((zone: Tier | null) => dispatch({ type: "FOCUS_ZONE", zone }), []);
	const moveAgent = useCallback((id: string, x: number, y: number) => dispatch({ type: "MOVE_AGENT", id, x, y }), []);
	const toggleSound = useCallback(() => dispatch({ type: "TOGGLE_SOUND" }), []);
	const renameGroup = useCallback((key: string, name: string) => dispatch({ type: "RENAME_GROUP", key, name }), []);
	const selectCandidate = useCallback((id: string | null) => dispatch({ type: "SELECT_CANDIDATE", id }), []);
	const promote = useCallback((id: string) => dispatch({ type: "PROMOTE", id }), []);
	const rollback = useCallback((id: string) => dispatch({ type: "ROLLBACK", id }), []);
	const hold = useCallback((id: string) => dispatch({ type: "HOLD", id }), []);
	const clearCeremony = useCallback(() => dispatch({ type: "CLEAR_CEREMONY" }), []);
	const resolveAction = useCallback((id: string, decision: "approve" | "deny" | "escalate") => dispatch({ type: "RESOLVE_ACTION", id, decision }), []);
	const acknowledgeIncident = useCallback((id: string) => dispatch({ type: "ACKNOWLEDGE_INCIDENT", id }), []);
	const assignCommander = useCallback((id: string) => dispatch({ type: "ASSIGN_COMMANDER", id }), []);
	const resolveIncident = useCallback((id: string) => dispatch({ type: "RESOLVE_INCIDENT", id }), []);
	const undoToast = useCallback(() => dispatch({ type: "UNDO_TOAST" }), []);
	const dismissToast = useCallback(() => dispatch({ type: "DISMISS_TOAST" }), []);

	const value = useMemo<LensContextValue>(
		() => ({
			state,
			setView,
			select,
			open,
			close,
			focusZone,
			moveAgent,
			toggleSound,
			renameGroup,
			selectCandidate,
			promote,
			rollback,
			hold,
			clearCeremony,
			resolveAction,
			acknowledgeIncident,
			assignCommander,
			resolveIncident,
			undoToast,
			dismissToast,
			worstStatus,
		}),
		[state, worstStatus, setView, select, open, close, focusZone, moveAgent, toggleSound, renameGroup, selectCandidate, promote, rollback, hold, clearCeremony, resolveAction, acknowledgeIncident, assignCommander, resolveIncident, undoToast, dismissToast],
	);

	return <LensContext.Provider value={value}>{children}</LensContext.Provider>;
}

export function useLens(): LensContextValue {
	const ctx = useContext(LensContext);
	if (!ctx) throw new Error("useLens must be used within a LensProvider");
	return ctx;
}

export { CELL, WORLD };
