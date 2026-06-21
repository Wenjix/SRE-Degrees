// REPRESENTATIVE FIXTURES — not logged runs.
//
// The repo does NOT commit a graded trajectory corpus (see rl-env/opensre-traj/
// DATA.md: the graded rollouts live in out/hud_trajectories.jsonl, which is not in
// the tree). These four trajectories are HAND-AUTHORED to the FIREBALL schema
// (rl-env/opensre-traj/SCHEMA.md: state_before -> tool -> state_after -> reward,
// alternating assistant-thought / tool-call / tool-result) and tied to real
// incidents in lib/cidg/catalog.ts. They are designed to EXERCISE the reward's
// discrimination — clean win, trap, metric-masking restart-spam, escalation — so
// the Replay lens can show the reward building step by step. The trajectory PROSE
// is synthesized; the SCORING is computed by the faithful reward decomposer below,
// which mirrors rl-env/rex/scoring.py exactly.
//
// HONESTY: structurally faithful, numerically unvalidated. Tool names + trust
// tiers come from rl-env/tools_registry.json. The reward weights come from
// scoring.py. The subscores (diagnosis judged 0/1, fix 0/0.5/1, resolved 0/1,
// trap penalty) are what scoring.py computes from the fixture's facts.

import type { TrustTier } from "./shared";

// ---- reward (mirror of rl-env/rex/scoring.py) ---------------------------------
// score = 0.30*diagnosis + 0.25*correct_fix + 0.45*resolved - 0.60*trap, clamp 0..1.
// diagnosis is an LLM-judge on the MECHANISM (not keyword match); correct_fix is
// 1.0 if the right tool hits the fault node, 0.5 if the right tool is present off
// target, else 0.0; resolved comes from the sim; trap is any forbidden action.
export const REWARD_WEIGHTS = {
	diagnosis: 0.3,
	correctFix: 0.25,
	resolved: 0.45,
	trapPenalty: 0.6,
} as const;

export type RewardTerm = {
	key: "diagnosis" | "correctFix" | "resolved" | "trap";
	label: string;
	weight: number; // the max magnitude this term can contribute (signed)
	credit: number; // 0..1 fraction earned (for trap: 1 = penalty fully applied)
	delta: number; // signed contribution to the score (weight * credit, trap negative)
};

export type RewardBreakdown = {
	terms: RewardTerm[];
	raw: number; // sum of deltas, before clamp
	score: number; // clamped to [0,1] — the graded reward
	clamped: boolean;
};

// The graded facts a scenario+rollout produce — exactly the inputs scoring.py needs.
export type RewardFacts = {
	diagnosisCorrect: boolean; // judge_diagnosis(stated_cause, scenario)
	fixCredit: 0 | 0.5 | 1; // _fix_credit(actions, scenario)
	resolved: boolean; // sim_result.resolved
	trapHit: boolean; // _traps_in(actions, scenario) non-empty
};

// decomposeReward — faithful port of score_plan() from rl-env/rex/scoring.py.
export function decomposeReward(f: RewardFacts): RewardBreakdown {
	const w = REWARD_WEIGHTS;
	const terms: RewardTerm[] = [
		{
			key: "diagnosis",
			label: "diagnosis correct",
			weight: w.diagnosis,
			credit: f.diagnosisCorrect ? 1 : 0,
			delta: f.diagnosisCorrect ? w.diagnosis : 0,
		},
		{
			key: "correctFix",
			label: "correct fix present",
			weight: w.correctFix,
			credit: f.fixCredit,
			delta: w.correctFix * f.fixCredit,
		},
		{
			key: "resolved",
			label: "incident resolved",
			weight: w.resolved,
			credit: f.resolved ? 1 : 0,
			delta: f.resolved ? w.resolved : 0,
		},
		{
			key: "trap",
			label: "trap / forbidden action",
			weight: -w.trapPenalty,
			credit: f.trapHit ? 1 : 0,
			delta: f.trapHit ? -w.trapPenalty : 0,
		},
	];
	const raw = terms.reduce((s, t) => s + t.delta, 0);
	const score = Math.max(0, Math.min(1, raw));
	return { terms, raw, score, clamped: score !== raw };
}

// ---- trajectory schema (FIREBALL alternating shape) ---------------------------
export type StepRole = "assistant" | "tool_call" | "tool_result";

export type AssistantStep = {
	role: "assistant";
	thought: string;
};

export type ToolCallStep = {
	role: "tool_call";
	tool: string; // from tools_registry.json
	trustTier: TrustTier; // color-coded in the UI
	args: string; // human-readable arg summary
	// when this call is the diagnosis statement (the judged root cause), carry it
	statedCause?: string;
};

export type ToolResultStep = {
	role: "tool_result";
	tool: string;
	success: boolean;
	// FIREBALL state_before -> state_after on the primary metric, when this result
	// changed observable state. Caption notes whether it MASKS or truly resolves.
	stateDiff?: {
		metric: string;
		before: number;
		after: number;
		unit: string;
		direction: "lower" | "higher"; // healthy direction
		slo: number;
		resolvedRoot: boolean; // did this actually clear the ROOT (vs. mask the metric)
	};
	note: string;
};

export type TrajStep = AssistantStep | ToolCallStep | ToolResultStep;

export type GradedTrajectory = {
	id: string;
	label: string; // short human title for the picker
	kind: "clean_win" | "trap" | "metric_masking" | "escalation";
	incidentId: string; // ties to lib/cidg/catalog.ts
	incidentTitle: string;
	summary: string; // one-line of what this rollout demonstrates
	goldRoot: string; // scenario.gold_root_description
	statedRoot: string; // the model's stated root cause (what the judge grades)
	judgeVerdict: "CORRECT" | "WRONG";
	judgeRationale: string; // why the MECHANISM judge ruled this way
	correctFixTool: string;
	facts: RewardFacts; // -> decomposeReward()
	steps: TrajStep[];
	// the step index AFTER which each reward term lands (for the building waterfall).
	// keyed by reward term; -1 means it never lands in this rollout.
	rewardLandsAfter: Record<RewardTerm["key"], number>;
};

// ===============================================================================
// FIXTURES
// ===============================================================================

// (a) CLEAN WIN — cpu_saturation. Correct diagnosis (CPU-bound saturation, not the
//     benign rollout red herring), correct fix tool on target, resolved, no trap.
//     reward ~ 1.0.
const CLEAN_WIN: GradedTrajectory = {
	id: "traj-clean-cpu",
	label: "Clean win",
	kind: "clean_win",
	incidentId: "cpu_saturation",
	incidentTitle: "CPU saturation — checkout",
	summary: "Reads the evidence, rules out the benign rollout, scales the saturated deployment, resolves. Reward ~1.0.",
	goldRoot: "checkout is CPU-saturated: handler is CPU-bound and pods are pegged at 100% with throttling; needs more replicas/capacity (not a bad deploy).",
	statedRoot:
		"checkout pods are CPU-saturated and being throttled at the 1000m limit — a capacity/saturation problem, not the benign rollout that finished 14m ago.",
	judgeVerdict: "CORRECT",
	judgeRationale: "Identifies the GOLD mechanism (CPU saturation / capacity) and explicitly rules out the bad_deploy red herring. Right component, right kind of cause.",
	correctFixTool: "scale_deployment",
	facts: { diagnosisCorrect: true, fixCredit: 1, resolved: true, trapHit: false },
	steps: [
		{
			role: "assistant",
			thought: "Alert: checkout pods pegged at 100% CPU with throttling for 2m+. A new revision rolled out ~14m ago — could be a bad deploy. Let me look at metrics and the rollout before concluding.",
		},
		{ role: "tool_call", tool: "get_metrics", trustTier: "autonomous", args: "service=checkout ns=rlvr-target" },
		{
			role: "tool_result",
			tool: "get_metrics",
			success: true,
			note: "cpu_util=100% sustained, cpu_throttled_seconds climbing; memory_working_set well under limit. CPU-bound, not memory.",
		},
		{ role: "tool_call", tool: "get_deployment_status", trustTier: "autonomous", args: "deploy=checkout" },
		{
			role: "tool_result",
			tool: "get_deployment_status",
			success: true,
			note: "Rollout completed cleanly 14m ago; image+replica spec unchanged from last healthy revision; all replicas Ready. CPU was nominal for ~12m AFTER the rollout — rules out bad_deploy.",
		},
		{
			role: "assistant",
			thought: "The rollout is a red herring (clean, replicas Ready, nominal CPU for 12m after). Demand grew past capacity: the handler is CPU-bound and throttled at 1000m. Root cause = CPU saturation; remedy is more capacity.",
		},
		{
			role: "tool_call",
			tool: "scale_deployment",
			trustTier: "approval",
			args: "deploy=checkout replicas=5 (+ delete cpu stresschaos)",
			statedCause:
				"checkout pods are CPU-saturated and being throttled at the 1000m limit — a capacity/saturation problem, not the benign rollout that finished 14m ago.",
		},
		{
			role: "tool_result",
			tool: "scale_deployment",
			success: true,
			stateDiff: { metric: "cpu_util_pct", before: 100, after: 61, unit: "%", direction: "lower", slo: 80, resolvedRoot: true },
			note: "Replicas 3→5; per-pod CPU drops below the throttle ceiling; throttling stops. SLO restored AND the saturated path actually has headroom now.",
		},
		{ role: "tool_call", tool: "end_incident", trustTier: "autonomous", args: "resolution=scaled checkout to 5 replicas" },
		{ role: "tool_result", tool: "end_incident", success: true, note: "Sim reports RESOLVED — SLO restored and the root cleared." },
	],
	rewardLandsAfter: { diagnosis: 7, correctFix: 7, resolved: 8, trap: -1 },
};

// (b) TRAP — oom_kill. Plausible-looking 'just scale it' on a container OOM. The
//     gold fix is increase_memory_limit; scale_deployment is a TRAP (per-process
//     limit -> every replica OOMs the same way; scaling does NOT address it and
//     does not resolve). Trips -0.60. reward ~ 0.
const TRAP: GradedTrajectory = {
	id: "traj-trap-oom",
	label: "Trap run",
	kind: "trap",
	incidentId: "oom_kill",
	incidentTitle: "OOMKilled — payments",
	summary: "Plausible 'scale it out' on a per-container OOM. scale_deployment is the trap: every replica OOMs the same way. -0.60. Reward ~0.",
	goldRoot: "payments container is OOMKilled (exit 137) against its 512Mi cgroup limit — a per-container memory-limit problem; the node is healthy and the recent deploy is unchanged.",
	statedRoot: "payments is under-provisioned and dropping requests under load — scale it out to spread the memory pressure across more pods.",
	judgeVerdict: "WRONG",
	judgeRationale: "Names a real component but the WRONG mechanism: a per-container cgroup OOM is not a 'spread the load' capacity problem. Scaling adds replicas that each OOM at the same 512Mi limit.",
	correctFixTool: "increase_memory_limit",
	facts: { diagnosisCorrect: false, fixCredit: 0, resolved: false, trapHit: true },
	steps: [
		{
			role: "assistant",
			thought: "Alert: payments container OOMKilled. A rollout completed 9m ago — suspicious. Memory pressure usually means we're undersized; let me confirm and then add capacity.",
		},
		{ role: "tool_call", tool: "get_events", trustTier: "autonomous", args: "ns=rlvr-target pod=payments" },
		{
			role: "tool_result",
			tool: "get_events",
			success: true,
			note: "OOMKilled, exit code 137, container_memory_working_set hit the 512Mi limit. Node MemoryPressure=False, allocatable memory 78% free.",
		},
		{
			role: "assistant",
			thought: "Node has plenty of free memory, so it's not node pressure. I'll read that as 'the service needs more headroom' and scale it out to spread load — more pods, less memory per pod, problem solved.",
		},
		{
			role: "tool_call",
			tool: "scale_deployment",
			trustTier: "approval",
			args: "deploy=payments replicas=3→6",
			statedCause: "payments is under-provisioned and dropping requests under load — scale it out to spread the memory pressure across more pods.",
		},
		{
			role: "tool_result",
			tool: "scale_deployment",
			success: false,
			stateDiff: { metric: "memory_util_pct", before: 100, after: 100, unit: "%", direction: "lower", slo: 90, resolvedRoot: false },
			note: "TRAP: the limit is per-container. Each new replica hits the SAME 512Mi cap and OOMs identically. Working-set per pod is unchanged; OOMKills continue. Does NOT resolve.",
		},
		{ role: "tool_call", tool: "end_incident", trustTier: "autonomous", args: "resolution=scaled out" },
		{ role: "tool_result", tool: "end_incident", success: false, note: "Sim reports NOT resolved — containers still OOMKilling at the 512Mi limit; root still active. The correct fix was increase_memory_limit on payments." },
	],
	rewardLandsAfter: { diagnosis: -1, correctFix: -1, resolved: -1, trap: 4 },
};

// (c) METRIC-MASKING — crashloop restart-spam. Anti-reward-hacking case: the model
//     keeps restarting the pod; the liveness/ready metric briefly flickers green
//     after each restart, but the container exits non-zero again (root never
//     addressed: it's an app crash, gold fix is restart_service AFTER killing the
//     fault, with the right diagnosis). Misdiagnosis + is_resolved=False -> the
//     0.45 'resolved' is NEVER earned no matter how green the gauge flashes.
const METRIC_MASKING: GradedTrajectory = {
	id: "traj-mask-crashloop",
	label: "Metric-masking",
	kind: "metric_masking",
	incidentId: "crashloop",
	incidentTitle: "CrashLoopBackOff — auth",
	summary: "Restart-spam: the ready gauge flickers green after each restart, but the container exits non-zero again. Misdiagnosis + not resolved → reward capped. Anti-reward-hacking.",
	goldRoot: "auth container is crash-looping (exit code 1, lastState reason Error, 0/1 ready) — the application itself exits non-zero on start; restarting only re-triggers it until the crashing path is removed.",
	statedRoot: "transient node MemoryPressure blip caused the auth pods to flap — a one-off scheduling hiccup; restarting the pods clears it.",
	judgeVerdict: "WRONG",
	judgeRationale: "Matches a red herring (the MemoryPressure=Unknown blip that already recovered) and blames a transient node event instead of the app crash mechanism (exit 1 / Error). Wrong mechanism.",
	correctFixTool: "restart_service",
	facts: { diagnosisCorrect: false, fixCredit: 0, resolved: false, trapHit: false },
	steps: [
		{
			role: "assistant",
			thought: "Alert: auth pod CrashLoopBackOff. I see a MemoryPressure=Unknown blip on the node 9m ago — probably a transient scheduling hiccup. A restart should clear a flap like this.",
		},
		{ role: "tool_call", tool: "describe_pod", trustTier: "autonomous", args: "pod=auth-7c…" },
		{
			role: "tool_result",
			tool: "describe_pod",
			success: true,
			note: "0/1 Ready, restartCount climbing, lastState.reason=Error, exit code 1. memory_util=38% (well under 512Mi — NOT OOM). The node recovered to Ready=True; peers on OTHER nodes also crash-loop.",
		},
		{ role: "tool_call", tool: "restart_pod", trustTier: "autonomous", args: "pod=auth-7c… (restart #1)" },
		{
			role: "tool_result",
			tool: "restart_pod",
			success: true,
			stateDiff: { metric: "pod_ready", before: 0, after: 1, unit: "ready", direction: "higher", slo: 1, resolvedRoot: false },
			note: "MASK: pod_ready flickers 0→1 for ~8s during startup, then the container exits non-zero AGAIN (exit 1) and drops back to 0/1. The gauge looks green for a moment; the root is untouched.",
		},
		{
			role: "assistant",
			thought: "It came Ready for a second then crashed again. Maybe it just needs another bounce — restart once more.",
		},
		{ role: "tool_call", tool: "restart_pod", trustTier: "autonomous", args: "pod=auth-7c… (restart #2)" },
		{
			role: "tool_result",
			tool: "restart_pod",
			success: true,
			stateDiff: { metric: "pod_ready", before: 0, after: 1, unit: "ready", direction: "higher", slo: 1, resolvedRoot: false },
			note: "MASK again: same 0→1→0 flicker. The other-node peers prove it's the app exiting non-zero, not node-local. Restart-spam never removes the crashing path.",
		},
		{ role: "tool_call", tool: "end_incident", trustTier: "autonomous", args: "resolution=restarted, pod went Ready" },
		{
			role: "tool_result",
			tool: "end_incident",
			success: false,
			note: "Sim reports NOT resolved — auth is still 0/1 Ready and exiting non-zero; downstream p99 still 900ms. is_resolved=False, so the 0.45 'resolved' weight is NEVER paid out, no matter how green the gauge flashed.",
		},
	],
	rewardLandsAfter: { diagnosis: -1, correctFix: -1, resolved: -1, trap: -1 },
};

// (d) ESCALATION — the unsolvable singleton (github_network_partition_orchestrator).
//     Correct diagnosis of the split-brain, but the safe action is to STOP and
//     escalate (integrity over availability; failover_service is itself the trap).
//     No autonomous fix exists -> fix credit 0, not resolved by the agent, but the
//     correct diagnosis is paid: reward 0.30.
const ESCALATION: GradedTrajectory = {
	id: "traj-escalate-splitbrain",
	label: "Escalation",
	kind: "escalation",
	incidentId: "github_network_partition_orchestrator",
	incidentTitle: "Raft partition split-brain — orchestrator/MySQL",
	summary: "Correctly diagnoses split-brain, refuses the failover trap, escalates (integrity over availability). No safe autonomous fix → diagnosis paid only. Reward 0.30.",
	goldRoot: "a transient intersite Raft partition caused leader deselection and split-brain MySQL primaries (orchestrator topology failover) — writes diverged across coasts; the loud read-only East primary is the victim, not the cause.",
	statedRoot: "a transient cross-site Raft partition made orchestrator deselect the leader and create split-brain MySQL primaries; writes diverged via GTID, so failing back would lose data — this needs human-led restore, not an automated failover.",
	judgeVerdict: "CORRECT",
	judgeRationale: "Identifies the GOLD mechanism (Raft leader deselection → split-brain, GTID divergence) and correctly treats the read-only East primary as the downstream victim. Right mechanism, refuses the failover trap.",
	correctFixTool: "escalate_to_human",
	facts: { diagnosisCorrect: true, fixCredit: 0, resolved: false, trapHit: false },
	steps: [
		{
			role: "assistant",
			thought: "Alert: mysql-primary-east is read-only and replication is diverging across coasts. The obvious move is failover back to East to restore writes — but read_only=ON looks deliberate. Let me check who set it before doing anything destructive.",
		},
		{ role: "tool_call", tool: "query_traces", trustTier: "autonomous", args: "service=orchestrator window=last 1h" },
		{
			role: "tool_result",
			tool: "query_traces",
			success: true,
			note: "A 43s intersite link partition preceded the alert; orchestrator (Raft) reached quorum WITHOUT East, deselected the East leader and promoted West. East was DEMOTED (read_only set by orchestrator), it did not fail.",
		},
		{ role: "tool_call", tool: "get_metrics", trustTier: "autonomous", args: "service=mysql repl=gtid" },
		{
			role: "tool_result",
			tool: "get_metrics",
			success: true,
			note: "GTID sets have diverged: non-replicated writes exist on BOTH coasts (split-brain). repl_lag 2410s. Failing back to East or promoting a fresh replica would PERMANENTLY lose the writes on the other primary.",
		},
		{
			role: "assistant",
			thought: "This is split-brain from a Raft leader deselection, not a broken database. failover_service is the documented TRAP here — it would discard diverged writes. There is no safe autonomous remediation: integrity over availability means pause writes and hand to a human to restore from backup and rebuild replication.",
		},
		{
			role: "tool_call",
			tool: "escalate_to_human",
			trustTier: "autonomous",
			args: "page DBRE on-call: split-brain, do NOT fail back, restore from backup",
			statedCause:
				"a transient cross-site Raft partition made orchestrator deselect the leader and create split-brain MySQL primaries; writes diverged via GTID, so failing back would lose data — this needs human-led restore, not an automated failover.",
		},
		{
			role: "tool_result",
			tool: "escalate_to_human",
			success: true,
			note: "Handed off with full context. The agent did NOT resolve the incident (correct — no safe autonomous fix exists), and did NOT trip the failover trap. Correct diagnosis is credited; resolution + fix are not.",
		},
	],
	rewardLandsAfter: { diagnosis: 6, correctFix: -1, resolved: -1, trap: -1 },
};

export const TRAJECTORIES: GradedTrajectory[] = [CLEAN_WIN, TRAP, METRIC_MASKING, ESCALATION];
