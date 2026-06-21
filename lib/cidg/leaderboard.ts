// LEADERBOARD — the multi-provider frontier sweep: does REx (the Thompson-tree
// refinement loop) lift a FROZEN, swappable model above its own zero-shot
// baseline? Same 5 incidents, same root-cause-aware reward, baseline = one
// zero-shot answer; REx = propose -> harness feedback -> refine (with the safety
// gate). Run it: `HUD_API_KEY=... python3 -m rex.frontier`.
//
// SINGLE SOURCE OF TRUTH: the per-model sweep numbers come from
// lib/rex-evidence.ts (FRONTIER_REX_SWEEP), the same module the promotion
// dossier reads — so the Lab leaderboard and the per-agent REx evidence can
// never drift apart. This module only adds the Lab's view-model extras (the
// incident set, the reward formula, the narrative findings).
//
// PROVENANCE (the lab's discipline):
//   MEASURED  — per-model baseline/rex/lift + clean-wins, from rl-env/ARCHITECTURE.md
//               ("REx lifts every frontier model"), produced by rl-env/rex/frontier.py.
//   STRUCTURAL — the REx per-(model,incident) cells: every model converges to the
//               SAME 0.86 = (4×1.0 + 0.30)/5 (4 solvable solved @1.0 + the unsolvable
//               singleton ESCALATED @0.30). The heatmap renders this structure.
//   NOT PUBLISHED — per-(model,incident) BASELINE cells are not individually reported;
//               we render baselines only as the per-model total + clean-wins count.

import {
	FRONTIER_REX_SWEEP,
	REX_TASKSET,
	frontierRexSummary,
	rexLift,
	type ScoredRexEvidence,
} from "@/lib/rex-evidence";

export const REWARD_FORMULA = {
	// rl-env/rex/scoring.py  (W_ROOT, W_FIX, W_RESOLVED, TRAP_PENALTY)
	expr: "score = 0.30·diagnosis + 0.25·correct_fix + 0.45·resolved − 0.60·trap",
	clamp: "clamp 0..1",
	terms: [
		{ key: "diagnosis", weight: 0.3, sign: "+", note: "LLM-judge on the MECHANISM (category), not the words" },
		{ key: "correct_fix", weight: 0.25, sign: "+", note: "the causal remediation tool is present in the plan" },
		{ key: "resolved", weight: 0.45, sign: "+", note: "sim reports SLO restored AND root cleared" },
		{ key: "trap", weight: 0.6, sign: "−", note: "any forbidden/worsening action (e.g. scale a crash-loop) → −0.60" },
	],
} as const;

const _summary = frontierRexSummary();

// The fixed sweep grid — derived from rex-evidence (REX_TASKSET) so the Lab and
// the promotion dossier agree on size/ceiling. budget is a frontier.py detail.
export const SWEEP = {
	budget: 3, // REx tree budget (frontier.py BUDGET)
	nIncidents: REX_TASKSET.tasksetSize,
	nSolvable: REX_TASKSET.solvableIncidents,
	nModels: _summary.modelCount,
	ceiling: _summary.ceilingScore, // 0.86 = (4 × 1.0 + 1 × 0.30) / 5
	ceilingIdentity: "(4×1.0 + 0.30) / 5 = 0.86",
};

export type Provider = "Anthropic" | "OpenAI" | "Google" | "DeepSeek";

export type LeaderboardRow = {
	model: string;
	provider: Provider;
	// "native" = Anthropic API directly; "gateway" = HUD inference gateway (one key).
	route: "native" | "gateway";
	// short note from the ARCHITECTURE table ("weak anchor" / "strong" …).
	anchor?: string;
	baseline: number; // MEASURED — zero-shot mean over the 5 incidents
	rex: number; // MEASURED — REx mean over the 5 incidents (all converge to 0.86)
	lift: number; // MEASURED — rex − baseline
	baselineCleanWins: number; // MEASURED — clean wins (reward ≈ 1.0) zero-shot, of 5
	rexCleanWins: number; // MEASURED — clean wins under REx, of 5
};

// rex-evidence encodes the route/anchor inside the provider string, e.g.
// "Anthropic (weak anchor)", "OpenAI (gateway)", "Anthropic (strong)".
function rowFromEvidence(e: ScoredRexEvidence): LeaderboardRow {
	const provider = e.provider.split(" (")[0] as Provider;
	const paren = e.provider.match(/\(([^)]+)\)/)?.[1];
	const route: "native" | "gateway" = paren === "gateway" ? "gateway" : "native";
	const anchor = paren && paren !== "gateway" ? paren : undefined;
	return {
		model: e.model,
		provider,
		route,
		anchor,
		baseline: e.baselineScore,
		rex: e.rexScore,
		lift: rexLift(e),
		baselineCleanWins: e.baselineCleanWins,
		rexCleanWins: e.rexCleanWins,
	};
}

export const LEADERBOARD: LeaderboardRow[] = FRONTIER_REX_SWEEP.map(rowFromEvidence);

// The fixed incident set (rl-env/rex/frontier.py SCENARIOS), in cascade order.
// `solvable` incidents have a safe causal fix; the singleton has NONE by design —
// the only correct move is to ESCALATE (diagnosis-only credit, 0.30). Unique to
// the Lab view (rex-evidence carries the taskset shape, not per-incident labels).
export type SweepIncident = {
	id: string;
	label: string;
	solvable: boolean;
	rexCell: number; // STRUCTURAL — under REx: 1.0 if solvable, 0.30 if escalated
	note: string;
};

export const SWEEP_INCIDENTS: SweepIncident[] = [
	{ id: "oom_kill", label: "oom_kill", solvable: true, rexCell: 1.0, note: "memory-limit OOM on the true root, not the loud victim" },
	{ id: "cpu_saturation_leaf", label: "cpu_saturation_leaf", solvable: true, rexCell: 1.0, note: "CPU-bound leaf saturates upstream callers" },
	{ id: "bad_deploy_leaf", label: "bad_deploy_leaf", solvable: true, rexCell: 1.0, note: "bad rollout on a leaf cascades; roll back the leaf" },
	{ id: "gcp_service_control", label: "gcp_service_control", solvable: true, rexCell: 1.0, note: "real GCP Service Control post-mortem" },
	{
		id: "singleton_node_notready",
		label: "singleton_node_notready",
		solvable: false,
		rexCell: REX_TASKSET.singletonEscalationScore,
		note: "no safe automated fix — REx ESCALATES instead of flailing; 0.30 = diagnosis-only credit",
	},
];

// The three structural findings (ARCHITECTURE.md, "Three things this shows").
export const FINDINGS: { title: string; body: string }[] = [
	{
		title: "Small + REx beats big zero-shot",
		body: "haiku+REx (0.86) > opus zero-shot (0.81). The loop, not the model size, closes the gap.",
	},
	{
		title: "REx compresses the capability spread",
		body: "Baselines range 0.63–0.81 across providers; with REx all five converge to 0.86, and the biggest lifts go to the weakest baselines.",
	},
	{
		title: "0.86 is the ceiling, not saturation",
		body: "It is (4×1.0 + 0.30)/5: every model solves all 4 solvable incidents AND correctly escalates the 1 unsolvable one. The safety gate holds.",
	},
];
