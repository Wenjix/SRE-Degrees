// REx evidence is calibration/proving data, not live fleet telemetry. Keep it
// pure and deterministic so promotion gates, docs, and tests read the same math.

export type RexEvidenceStatus = "preliminary";
export type RexModelRole = "frontier" | "training-target";
export type RexProvider = "Anthropic" | "OpenAI" | "Google" | "DeepSeek";

export type ScoredRexEvidence = {
	id: string;
	role: "frontier";
	model: string;
	provider: string; // display string, e.g. "Anthropic (weak anchor)"
	providerName: RexProvider; // structured — canonical provider, enforced by the union
	inferenceRoute: "native" | "gateway"; // structured — replaces the parenthetical route encoding
	routeNote?: string; // structured — optional qualifier ("weak anchor" / "strong")
	tasksetId: string;
	harnessVersion: string;
	status: RexEvidenceStatus;
	tasksetSize: number;
	solvableIncidents: number;
	unsolvableIncidents: number;
	singletonEscalationScore: number;
	ceilingScore: number;
	baselineScore: number;
	rexScore: number;
	baselineCleanWins: number;
	rexCleanWins: number;
	tracedInHud: boolean;
};

export type RexTrainingTarget = {
	id: string;
	role: "training-target";
	model: string;
	provider: string;
	status: "pending";
	targetTasksetId: string;
	note: string;
};

export type RexEvidence = ScoredRexEvidence | RexTrainingTarget;

export const QWEN_REX_TARGET: RexTrainingTarget = {
	id: "target:qwen3-30b-a3b",
	role: "training-target",
	model: "Qwen3-30B-A3B",
	provider: "Qwen / open weights",
	status: "pending",
	targetTasksetId: "rex-sre-frontier-v0",
	note: "Trainable student target; do not include in frontier claims until its own sweep exists.",
};

export const REX_TASKSET = {
	id: "rex-sre-frontier-v0",
	harnessVersion: "rex-action-plan-sim-v1",
	status: "preliminary" as const,
	tasksetSize: 5,
	solvableIncidents: 4,
	unsolvableIncidents: 1,
	singletonEscalationScore: 0.3,
};

export function roundScore(n: number): number {
	return Math.round(n * 1000) / 1000;
}

export function formatScore(n: number): string {
	return n.toFixed(3);
}

export function rexCeiling({
	solvableIncidents,
	unsolvableIncidents,
	singletonEscalationScore,
}: {
	solvableIncidents: number;
	unsolvableIncidents: number;
	singletonEscalationScore: number;
}): number {
	const total = solvableIncidents + unsolvableIncidents;
	if (total <= 0) return 0;
	return roundScore((solvableIncidents + unsolvableIncidents * singletonEscalationScore) / total);
}

const CEILING = rexCeiling(REX_TASKSET);
const base = {
	tasksetId: REX_TASKSET.id,
	harnessVersion: REX_TASKSET.harnessVersion,
	status: REX_TASKSET.status,
	tasksetSize: REX_TASKSET.tasksetSize,
	solvableIncidents: REX_TASKSET.solvableIncidents,
	unsolvableIncidents: REX_TASKSET.unsolvableIncidents,
	singletonEscalationScore: REX_TASKSET.singletonEscalationScore,
	ceilingScore: CEILING,
	tracedInHud: false,
} satisfies Omit<ScoredRexEvidence, "id" | "role" | "model" | "provider" | "providerName" | "inferenceRoute" | "routeNote" | "baselineScore" | "rexScore" | "baselineCleanWins" | "rexCleanWins">;

export const FRONTIER_REX_SWEEP: ScoredRexEvidence[] = [
	{
		...base,
		id: "frontier:claude-haiku-4-5",
		role: "frontier",
		model: "claude-haiku-4-5",
		provider: "Anthropic (weak anchor)",
		providerName: "Anthropic",
		inferenceRoute: "native",
		routeNote: "weak anchor",
		baselineScore: 0.63,
		rexScore: 0.86,
		baselineCleanWins: 2,
		rexCleanWins: 4,
	},
	{
		...base,
		id: "frontier:gpt-5.5",
		role: "frontier",
		model: "gpt-5.5",
		provider: "OpenAI (gateway)",
		providerName: "OpenAI",
		inferenceRoute: "gateway",
		baselineScore: 0.63,
		rexScore: 0.86,
		baselineCleanWins: 2,
		rexCleanWins: 4,
	},
	{
		...base,
		id: "frontier:gemini-3.1-pro",
		role: "frontier",
		model: "gemini-3.1-pro",
		provider: "Google (gateway)",
		providerName: "Google",
		inferenceRoute: "gateway",
		baselineScore: 0.75,
		rexScore: 0.86,
		baselineCleanWins: 3,
		rexCleanWins: 4,
	},
	{
		...base,
		id: "frontier:deepseek-v4-pro",
		role: "frontier",
		model: "deepseek-v4-pro",
		provider: "DeepSeek (gateway)",
		providerName: "DeepSeek",
		inferenceRoute: "gateway",
		baselineScore: 0.81,
		rexScore: 0.86,
		baselineCleanWins: 3,
		rexCleanWins: 4,
	},
	{
		...base,
		id: "frontier:claude-opus-4-8",
		role: "frontier",
		model: "claude-opus-4-8",
		provider: "Anthropic (strong)",
		providerName: "Anthropic",
		inferenceRoute: "native",
		routeNote: "strong",
		baselineScore: 0.81,
		rexScore: 0.86,
		baselineCleanWins: 3,
		rexCleanWins: 4,
	},
];

const AGENT_EVIDENCE: Record<string, string> = {
	"sre-7f2a": "frontier:claude-haiku-4-5",
	"sre-3a07": "frontier:gpt-5.5",
	"sre-4c2d": "frontier:claude-opus-4-8",
	"sre-2b90": "frontier:gemini-3.1-pro",
	"sre-8a13": "frontier:deepseek-v4-pro",
	"sre-9c1f": "frontier:claude-haiku-4-5",
};

function hashId(id: string): number {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return h;
}

export function rexEvidenceForAgent(agentId: string): ScoredRexEvidence {
	const explicit = AGENT_EVIDENCE[agentId];
	if (explicit) return FRONTIER_REX_SWEEP.find((e) => e.id === explicit) ?? FRONTIER_REX_SWEEP[0];
	return FRONTIER_REX_SWEEP[hashId(agentId) % FRONTIER_REX_SWEEP.length];
}

export function rexLift(e: ScoredRexEvidence): number {
	return roundScore(e.rexScore - e.baselineScore);
}

export function rexCleanWinLift(e: ScoredRexEvidence): number {
	return e.rexCleanWins - e.baselineCleanWins;
}

export function rexAtCeiling(e: ScoredRexEvidence): boolean {
	return Math.abs(e.rexScore - e.ceilingScore) < 0.0005;
}

export function rexPromotionSignal(e: ScoredRexEvidence, taskCoverage: number): { pass: boolean; reason: string } {
	if (taskCoverage < 0.8) return { pass: false, reason: "task coverage too thin" };
	if (!rexAtCeiling(e)) return { pass: false, reason: "below ceiling-aware score" };
	if (e.rexCleanWins < e.solvableIncidents) return { pass: false, reason: "missing clean wins on solvable incidents" };
	if (e.singletonEscalationScore < 0.3) return { pass: false, reason: "unsafe singleton escalation" };
	return { pass: true, reason: "ceiling-aware REx proof" };
}

export function frontierRexSummary(rows: ScoredRexEvidence[] = FRONTIER_REX_SWEEP) {
	const baselineScores = rows.map((r) => r.baselineScore);
	const rexScores = rows.map((r) => r.rexScore);
	const baselineMin = Math.min(...baselineScores);
	const baselineMax = Math.max(...baselineScores);
	const rexMin = Math.min(...rexScores);
	const rexMax = Math.max(...rexScores);
	return {
		modelCount: rows.length,
		tasksetSize: REX_TASKSET.tasksetSize,
		status: REX_TASKSET.status,
		ceilingScore: CEILING,
		baselineMin,
		baselineMax,
		rexMin,
		rexMax,
		baselineSpread: roundScore(baselineMax - baselineMin),
		rexSpread: roundScore(rexMax - rexMin),
		maxLift: Math.max(...rows.map(rexLift)),
		cleanWinsBaseline: rows.reduce((s, r) => s + r.baselineCleanWins, 0),
		cleanWinsRex: rows.reduce((s, r) => s + r.rexCleanWins, 0),
		cleanWinSlots: rows.length * REX_TASKSET.tasksetSize,
		allAtCeiling: rows.every(rexAtCeiling),
		qwenTarget: QWEN_REX_TARGET.model,
	};
}
