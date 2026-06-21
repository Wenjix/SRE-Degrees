// Shared vocabulary for the CIDG Lab lenses. The whole lab obeys the Reticle
// encoding contract: health is the ONLY saturated color (green/amber/red), and a
// reward/score on [0,1] reads as health — a clean win is green, a trap is red.

export type TrustTier = "autonomous" | "approval" | "blocked";

// A reward/score in [0,1] -> the one health hue it earns. The 0.86 frontier
// ceiling is a "good" green; baselines in the 0.6s are amber; a tripped trap
// (reward ~0) is red.
export function scoreColor(v: number): string {
	if (v >= 0.8) return "var(--ret-green)";
	if (v >= 0.5) return "var(--ret-amber)";
	return "var(--ret-red)";
}

// Difficulty 1..5 -> health ramp (harder incidents read hotter).
export function difficultyColor(d: number): string {
	if (d >= 4) return "var(--ret-red)";
	if (d >= 3) return "var(--ret-amber)";
	return "var(--ret-text-dim)";
}

export const TRUST_TIER_LABEL: Record<TrustTier, string> = {
	autonomous: "auto",
	approval: "approval",
	blocked: "blocked",
};

// Trust tier -> color. Blocked actions are the dangerous ones (red); approval is
// the human-in-the-loop amber; autonomous is the earned green.
export const TRUST_TIER_COLOR: Record<TrustTier, string> = {
	autonomous: "var(--ret-green)",
	approval: "var(--ret-amber)",
	blocked: "var(--ret-red)",
};

export function pct(v: number, digits = 0): string {
	return `${(v * 100).toFixed(digits)}%`;
}

export function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

// Turn an incident id like "aws_kinesis_cell_manager" into "Aws Kinesis Cell Manager".
export function titleize(id: string): string {
	return id
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}
