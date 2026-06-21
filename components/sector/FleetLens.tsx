"use client";

import { ArrowDownRight, ArrowUpRight, Circle, GitBranch, ShieldAlert, Users } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
	budgetPortfolio,
	correlatedAuthority,
	fleetEconomics,
	fleetGovernance,
	ownershipRollup,
	TIER_ORDER,
	type AuthorityRisk,
} from "@/lib/fleet";
import { AUTONOMY_FILL_PCT, TIER_LABEL } from "@/lib/promotion";

import { useLens } from "./LensProvider";
import { burnFraction, STATUS_COLOR_VAR } from "./visual";

// The VP telescope: the whole fleet read from orbit — what it costs, how much of
// it runs without a human, where authority is dangerously concentrated, who owns
// that risk, and which owned budgets are burning. Live over the shared store.
// Color stays health-only; autonomy stays ink + position.
export function FleetLens({ className }: { className?: string }) {
	const { state, select, focusZone } = useLens();
	const agents = state.agents;
	const econ = useMemo(() => fleetEconomics(agents), [agents]);
	const gov = useMemo(() => fleetGovernance(agents), [agents]);
	const risks = useMemo(() => correlatedAuthority(agents), [agents]);
	const owners = useMemo(() => ownershipRollup(agents), [agents]);
	const budget = useMemo(() => budgetPortfolio(agents), [agents]);
	const fleetTotal = agents.length;

	const focusAgentByName = (name: string) => {
		const a = agents.find((x) => x.name === name);
		if (a) {
			select(a.id);
			focusZone(a.zone);
		}
	};

	return (
		<div className={cn("h-full overflow-y-auto px-4 py-3", className)}>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 className="ret-display text-[13px] tracking-[0.16em]">FLEET · RISK &amp; ECONOMICS</h2>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">
					{fleetTotal} agents · {owners.length} teams · portfolio view
				</span>
			</div>

			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				{/* ECONOMICS */}
				<Panel title="Economics" hint="fleet spend">
					<div className="flex items-end gap-3">
						<span className="font-mono text-[30px] leading-none tabular-nums">${grp(econ.costHr)}</span>
						<span className="pb-1 font-mono text-[11px] text-[var(--ret-text-muted)]">/hr</span>
						<Delta pct={econ.costDeltaPct} className="pb-1" suffix="wk" />
					</div>
					<p className="mt-1.5 font-mono text-[11px] text-[var(--ret-text-dim)]">
						{grp(econ.tokensPerMin)} tok/min · ${econ.costPerKActions.toFixed(2)} / 1k actions
					</p>

					<div className="mt-3">
						<Bar segments={econ.byTeam.map((t, i) => ({ frac: t.costHr / Math.max(1, econ.costHr), opacity: teamInk(i) }))} />
						<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-[var(--ret-text-muted)]">
							{econ.byTeam.map((t) => (
								<span key={t.team}>
									{t.team.replace("-tier", "")} <span className="text-[var(--ret-text-dim)] tabular-nums">${t.costHr}</span>
								</span>
							))}
						</div>
					</div>

					{econ.runaway.length ? (
						<p className="mt-3 border-t border-[var(--ret-border)] pt-2 font-mono text-[10px] text-[var(--ret-text-muted)]">
							{econ.runaway.length} runaway ·{" "}
							{econ.runaway.map((r, i) => (
								<span key={r.name}>
									{i > 0 ? " · " : ""}
									<button type="button" onClick={() => focusAgentByName(r.name)} className="underline-offset-2 hover:underline">
										{r.name}
									</button>{" "}
									<span className="tabular-nums" style={{ color: STATUS_COLOR_VAR.critical }}>
										${r.costHr}
									</span>
								</span>
							))}
						</p>
					) : null}
				</Panel>

				{/* OVERSIGHT */}
				<Panel title="Oversight" hint="autonomy ladder">
					<Bar
						segments={TIER_ORDER.map((t) => ({
							frac: (gov.byTier[t] ?? 0) / Math.max(1, fleetTotal),
							opacity: tierInk(t),
						}))}
					/>
					<div className="mt-1.5 grid grid-cols-4 gap-1 font-mono text-[10px]">
						{TIER_ORDER.map((t) => (
							<div key={t} className="flex items-baseline gap-1">
								<span className="text-[var(--ret-text-muted)]">{TIER_LABEL[t].slice(0, 4)}</span>
								<span className="tabular-nums text-[var(--ret-text)]">{gov.byTier[t] ?? 0}</span>
							</div>
						))}
					</div>

					<div className="mt-3 flex items-center gap-3 border-t border-[var(--ret-border)] pt-2">
						<Delta pct={netPct(gov.netLadderSteps)} label={`net ${gov.netLadderSteps >= 0 ? "+" : ""}${gov.netLadderSteps} ladder step${Math.abs(gov.netLadderSteps) === 1 ? "" : "s"}`} suffix="wk" hideValue />
						<span className="h-3 w-px bg-[var(--ret-border)]" aria-hidden="true" />
						<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">
							override <span className="tabular-nums text-[var(--ret-text-dim)]">{(gov.fleetOverrideRate * 100).toFixed(1)}%</span>
						</span>
						<Delta pct={gov.overrideDeltaPct} suffix="wk" />
					</div>

					<div className="mt-2 flex items-center gap-2">
						<Circle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
						<span className="font-mono text-[11px] font-semibold text-[var(--ret-text)]">
							{gov.autonomousInProd.length} autonomous in production
						</span>
						{gov.autonomousInProd.length ? (
							<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">
								{gov.autonomousInProd.join(", ")} · no human in any loop
							</span>
						) : null}
					</div>
					<p className="mt-0.5 pl-5 font-mono text-[10px] text-[var(--ret-text-muted)]">
						{gov.highAutonomyInProd} guarded+ on real traffic · {gov.inCooldown} recovering trust · {gov.autoDemotions7d} auto-demotion (7d)
					</p>
				</Panel>
			</div>

			{/* CORRELATED AUTHORITY */}
			<Panel title="Correlated authority" hint="blast correlation" className="mt-3">
				{risks.length === 0 ? (
					<p className="font-mono text-[12px] text-[var(--ret-text-muted)]">No concentrated authority detected.</p>
				) : (
					<ul className="space-y-2">
						{risks.map((r) => (
							<AuthorityRow key={r.id} risk={r} onPick={focusAgentByName} />
						))}
					</ul>
				)}
			</Panel>

			<div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
				{/* OWNERSHIP */}
				<Panel title="Ownership" hint="who owns the risk">
					<table className="w-full border-collapse font-mono text-[11px]">
						<thead>
							<tr className="text-left text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">
								<th className="pb-1 font-normal">team</th>
								<th className="pb-1 font-normal">lead</th>
								<th className="pb-1 text-right font-normal">agents</th>
								<th className="pb-1 text-right font-normal">auton</th>
								<th className="pb-1 text-right font-normal">$/hr</th>
								<th className="pb-1 text-right font-normal">crit</th>
							</tr>
						</thead>
						<tbody>
							{owners.map((o) => (
								<tr key={o.team} className="border-t border-[var(--ret-border)]/60">
									<td className="py-1 text-[var(--ret-text)]">{o.team.replace("-tier", "")}</td>
									<td className="py-1 text-[var(--ret-text-dim)]">@{o.lead}</td>
									<td className="py-1 text-right tabular-nums text-[var(--ret-text-dim)]">{o.agents}</td>
									<td className="py-1 text-right tabular-nums text-[var(--ret-text-dim)]">{o.highAutonomy}</td>
									<td className="py-1 text-right tabular-nums text-[var(--ret-text-dim)]">{o.costHr}</td>
									<td className="py-1 text-right tabular-nums">
										{o.criticals > 0 ? <span style={{ color: STATUS_COLOR_VAR.critical }}>{o.criticals}</span> : <span className="text-[var(--ret-text-muted)]">0</span>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</Panel>

				{/* BUDGET PORTFOLIO */}
				<Panel title="Error-budget portfolio" hint="owned-service burn">
					<p className="font-mono text-[11px] text-[var(--ret-text-dim)]">
						<span className="tabular-nums" style={{ color: budget.burning.length ? STATUS_COLOR_VAR.critical : "var(--ret-text)" }}>
							{budget.burning.length}
						</span>{" "}
						burning · <span className="tabular-nums text-[var(--ret-text)]">{budget.withinBudget}</span> within budget
					</p>
					{budget.burning.length ? (
						<ul className="mt-2 space-y-1.5">
							{budget.burning.map((s) => (
								<li key={s.service} className="flex items-center gap-2 font-mono text-[10px]">
									<span className="w-36 shrink-0 truncate text-[var(--ret-text)]">{s.service}</span>
									<span className="relative h-1.5 flex-1 bg-[var(--ret-border)]/40" aria-hidden="true">
										<span
											className="absolute inset-y-0 left-0 block"
											style={{ width: `${Math.round(burnFraction(s.burnRate) * 100)}%`, backgroundColor: STATUS_COLOR_VAR.critical }}
										/>
									</span>
									<span className="w-8 shrink-0 text-right tabular-nums" style={{ color: STATUS_COLOR_VAR.critical }}>
										{s.burnRate}×
									</span>
									<span className="w-10 shrink-0 text-right text-[var(--ret-text-muted)]">{s.team.replace("-tier", "")}</span>
								</li>
							))}
						</ul>
					) : null}
				</Panel>
			</div>
		</div>
	);
}

// --- instrument shell -------------------------------------------------------
function Panel({ title, hint, className, children }: { title: string; hint?: string; className?: string; children: ReactNode }) {
	return (
		<section className={cn("border border-[var(--ret-border)] bg-[var(--ret-bg)] p-3", className)}>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text)]">{title}</span>
				{hint ? <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">{hint}</span> : null}
			</div>
			{children}
		</section>
	);
}

// Monochrome segmented bar (ink only — never color). Used for spend-by-team and
// the autonomy ladder; opacity carries the ordering.
function Bar({ segments }: { segments: { frac: number; opacity: number }[] }) {
	return (
		<div className="flex h-2.5 w-full overflow-hidden bg-[var(--ret-border)]/30" aria-hidden="true">
			{segments.map((s, i) => (
				<span
					key={i}
					className="block h-full border-r border-[var(--ret-bg)] last:border-r-0"
					style={{ width: `${Math.max(0, s.frac) * 100}%`, backgroundColor: "var(--ret-text)", opacity: s.opacity }}
				/>
			))}
		</div>
	);
}

// Week-over-week delta chip. Direction is shown by the glyph; the value is ink,
// not health-color — a cost rise is a fact to watch, not an alarm.
function Delta({
	pct,
	label,
	suffix,
	className,
	hideValue = false,
}: {
	pct: number;
	label?: string;
	suffix?: string;
	className?: string;
	hideValue?: boolean;
}) {
	if (pct === 0 && !label) {
		return <span className={cn("font-mono text-[10px] text-[var(--ret-text-muted)]", className)}>flat</span>;
	}
	const up = pct > 0;
	const Icon = up ? ArrowUpRight : ArrowDownRight;
	// cost and override are both bad-when-rising — emphasize only an upward move
	const notable = up;
	return (
		<span className={cn("flex items-center gap-0.5 font-mono text-[10px]", notable ? "text-[var(--ret-text-dim)]" : "text-[var(--ret-text-muted)]", className)}>
			<Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
			{label ? <span>{label}</span> : null}
			{!hideValue ? <span className="tabular-nums">{Math.abs(pct)}%</span> : null}
			{suffix ? <span className="text-[var(--ret-text-muted)]">{suffix}</span> : null}
		</span>
	);
}

const RISK_ICON = { hub: GitBranch, "autonomous-upstream": Circle, "shared-mutate": ShieldAlert } as const;

function AuthorityRow({ risk, onPick }: { risk: AuthorityRisk; onPick: (name: string) => void }) {
	const Icon = RISK_ICON[risk.kind] ?? Users;
	return (
		<li className="flex gap-2.5">
			<Icon
				className="mt-0.5 h-3.5 w-3.5 shrink-0"
				strokeWidth={1.75}
				aria-hidden="true"
				style={risk.high ? { color: STATUS_COLOR_VAR.critical } : { color: "var(--ret-text-muted)" }}
			/>
			<div className="min-w-0">
				<div className={cn("text-[12px]", risk.high ? "font-semibold text-[var(--ret-text)]" : "text-[var(--ret-text-dim)]")}>{risk.title}</div>
				<p className="font-mono text-[10px] leading-relaxed text-[var(--ret-text-muted)]">{risk.detail}</p>
				<div className="mt-0.5 flex flex-wrap gap-1">
					{risk.agents.map((n) => (
						<button
							key={n}
							type="button"
							onClick={() => onPick(n)}
							className="border border-[var(--ret-border)] px-1 py-0.5 font-mono text-[9px] text-[var(--ret-text-dim)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]"
						>
							{n}
						</button>
					))}
				</div>
			</div>
		</li>
	);
}

// --- pure view helpers ------------------------------------------------------
const grp = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// autonomy ink: rising opacity = rising autonomy (floored for visibility)
const tierInk = (t: (typeof TIER_ORDER)[number]) => 0.25 + 0.75 * (AUTONOMY_FILL_PCT[t] / 100);
// spend-by-team ink: descending shades so the biggest spender reads strongest
const teamInk = (i: number) => Math.max(0.3, 0.9 - i * 0.18);
// map net ladder movement to a pseudo-pct so the Delta glyph points the right way
const netPct = (steps: number) => (steps === 0 ? 0 : steps > 0 ? 1 : -1);
