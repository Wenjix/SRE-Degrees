"use client";

import { useMemo, useState } from "react";

import { ArrowDown, ArrowUp, ExternalLink, MessageSquareQuote } from "lucide-react";

import { cn } from "@/lib/cn";
import {
	ACTIVITY_MONTHS,
	BUYER_QUOTES,
	PAIN_KEYWORDS,
	SUBREDDITS,
	TIER_SERIES,
	TOOL_MENTIONS,
	TOP_POSTS,
	VOICES_STATS,
	type BuyerQuote,
	type ToolMention,
	type VoicePost,
} from "@/lib/cidg/voices";

// VOICES — the Voice-of-the-Buyer reddit market-research explorer that motivates
// CIDG. A corpus of 809 posts / 2970 comments across 10 subreddits was mined for
// pain keywords + tool mentions; this lens is the evidence surface. Encoding stays
// health-only: bars/lines are ink (opacity carries ordering), and the only place
// color appears is to flag the named "surprises" the pain synthesis called out.
// All numeric series are MEASURED; the post/quote selection is a curated on-topic
// subset (labeled in the UI).

type SortKey = "score" | "comments" | "subreddit";
const ACCENT = "var(--ret-text)";

// Tool category groups, in the order the pain synthesis discusses them.
const TOOL_GROUPS: { key: string; label: string }[] = [
	{ key: "iac", label: "infra-as-code" },
	{ key: "orchestration", label: "orchestration" },
	{ key: "ci/cd", label: "ci/cd" },
	{ key: "observability", label: "observability" },
	{ key: "incident", label: "incident / on-call" },
	{ key: "ai", label: "ai coding" },
];

export function VoicesLens() {
	// cross-filter: a chosen subreddit and/or keyword narrows the leaderboard +
	// quote cards. Bars stay global (they ARE the corpus-wide signal).
	const [subreddit, setSubreddit] = useState<string>("all");
	const [keyword, setKeyword] = useState<string>("all");
	const [sortKey, setSortKey] = useState<SortKey>("score");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

	const keywordTerms = useMemo(() => PAIN_KEYWORDS.slice(0, 8).map((k) => k.term), []);

	const filteredPosts = useMemo(() => {
		const rows = TOP_POSTS.filter((p) => {
			if (subreddit !== "all" && p.subreddit !== subreddit) return false;
			if (keyword !== "all") {
				const hay = `${p.title} ${p.theme}`.toLowerCase();
				if (!hay.includes(keyword.toLowerCase())) return false;
			}
			return true;
		});
		const dir = sortDir === "desc" ? -1 : 1;
		return [...rows].sort((a, b) => {
			if (sortKey === "subreddit") return dir * a.subreddit.localeCompare(b.subreddit);
			return dir * (a[sortKey] - b[sortKey]);
		});
	}, [subreddit, keyword, sortKey, sortDir]);

	const filteredQuotes = useMemo(
		() =>
			BUYER_QUOTES.filter((q) => {
				if (subreddit !== "all" && q.subreddit !== subreddit) return false;
				if (keyword !== "all") {
					const hay = `${q.keyword} ${q.postTitle} ${q.body}`.toLowerCase();
					if (!hay.includes(keyword.toLowerCase())) return false;
				}
				return true;
			}),
		[subreddit, keyword],
	);

	const toggleSort = (k: SortKey) => {
		if (k === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
		else {
			setSortKey(k);
			setSortDir(k === "subreddit" ? "asc" : "desc");
		}
	};

	const filterActive = subreddit !== "all" || keyword !== "all";

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* header + cross-filters */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
				<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">
							Voice of the buyer · reddit EDA
						</p>
						<h1 className="ret-display text-[16px]">
							What operators <span className="text-[var(--ret-text-muted)]">actually</span> complain about
						</h1>
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-[var(--ret-text-muted)]">
						<span>
							<span className="text-[var(--ret-text)]">{VOICES_STATS.totalPosts}</span> posts
						</span>
						<span>
							<span className="text-[var(--ret-text)]">{VOICES_STATS.totalComments.toLocaleString()}</span> comments
						</span>
						<span>
							<span className="text-[var(--ret-text)]">{VOICES_STATS.subredditCount}</span> subs
						</span>
						<span>
							{VOICES_STATS.earliest} → {VOICES_STATS.latest}
						</span>
					</div>
				</div>

				<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">subreddit</span>
					<Chip active={subreddit === "all"} onClick={() => setSubreddit("all")}>
						all
					</Chip>
					{SUBREDDITS.map((s) => (
						<Chip key={s.name} active={subreddit === s.name} onClick={() => setSubreddit(s.name)}>
							{s.name} {s.posts}
						</Chip>
					))}
				</div>

				<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">keyword</span>
					<Chip active={keyword === "all"} onClick={() => setKeyword("all")}>
						any
					</Chip>
					{keywordTerms.map((t) => (
						<Chip key={t} active={keyword === t} onClick={() => setKeyword(t)}>
							{t}
						</Chip>
					))}
					{filterActive ? (
						<button
							type="button"
							onClick={() => {
								setSubreddit("all");
								setKeyword("all");
							}}
							className="ml-1 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)] underline-offset-2 hover:text-[var(--ret-text)] hover:underline"
						>
							clear
						</button>
					) : null}
				</div>
			</div>

			{/* scroll body */}
			<div className="min-h-0 flex-1 overflow-auto p-3">
				<p className="mb-3 font-mono text-[10px] leading-relaxed text-[var(--ret-text-muted)]">
					Reddit market-research EDA — the motivation evidence behind CIDG. Bar/line counts are{" "}
					<span className="text-[var(--ret-text-dim)]">measured</span> from the corpus; the post leaderboard and quote
					cards are a <span className="text-[var(--ret-text-dim)]">curated on-topic subset</span> (incident /
					reliability posts), each keeping its real subreddit, score and permalink.
				</p>

				<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
					<Panel title="Pain keywords" hint="mentions across corpus · click to filter">
						<KeywordBars
							activeTerm={keyword}
							onPick={(t) => setKeyword((cur) => (cur === t ? "all" : t))}
						/>
					</Panel>

					<Panel title="Tool mentions" hint="by category · surprises flagged">
						<ToolBars />
					</Panel>
				</div>

				<Panel title="Activity over time" hint="posts / month by subreddit tier" className="mt-3">
					<TierTimeSeries />
				</Panel>

				<div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
					<Panel title="Top posts" hint={`${filteredPosts.length} of ${TOP_POSTS.length} · curated incident set`}>
						<Leaderboard rows={filteredPosts} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
					</Panel>

					<Panel title="Buyer quotes" hint={`${filteredQuotes.length} verbatim`}>
						<QuoteCards quotes={filteredQuotes} />
					</Panel>
				</div>
			</div>
		</div>
	);
}

// --- pain keyword bars (cross-filter trigger) ------------------------------
function KeywordBars({ activeTerm, onPick }: { activeTerm: string; onPick: (t: string) => void }) {
	const max = PAIN_KEYWORDS[0]?.count ?? 1;
	return (
		<ul className="space-y-1">
			{PAIN_KEYWORDS.map((k, i) => {
				const active = activeTerm === k.term;
				const frac = k.count / max;
				return (
					<li key={k.term}>
						<button
							type="button"
							onClick={() => onPick(k.term)}
							aria-pressed={active}
							className="group grid w-full grid-cols-[88px_1fr_28px] items-center gap-2 text-left outline-none"
						>
							<span
								className={cn(
									"truncate font-mono text-[10px] uppercase tracking-wide",
									active ? "text-[var(--ret-text)]" : "text-[var(--ret-text-muted)] group-hover:text-[var(--ret-text-dim)]",
								)}
							>
								{k.term}
							</span>
							<span className="relative h-3 bg-[var(--ret-border)]/30" aria-hidden="true">
								<span
									className="absolute inset-y-0 left-0 block transition-[width]"
									style={{
										width: `${Math.max(2, frac * 100)}%`,
										backgroundColor: ACCENT,
										// #1 trust reads strongest; opacity ramps down by rank, floored.
										opacity: active ? 1 : Math.max(0.28, 0.92 - i * 0.045),
									}}
								/>
							</span>
							<span className="text-right font-mono text-[11px] tabular-nums text-[var(--ret-text-dim)]">{k.count}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

// --- tool mention bars (grouped) -------------------------------------------
function ToolBars() {
	const byGroup = useMemo(() => {
		const m = new Map<string, ToolMention[]>();
		for (const t of TOOL_MENTIONS) {
			if (!m.has(t.category)) m.set(t.category, []);
			m.get(t.category)!.push(t);
		}
		return m;
	}, []);
	const max = TOOL_MENTIONS[0]?.count ?? 1;

	return (
		<div className="space-y-2.5">
			{TOOL_GROUPS.map((g) => {
				const tools = (byGroup.get(g.key) ?? []).slice(0, 5);
				if (!tools.length) return null;
				return (
					<div key={g.key}>
						<p className="mb-1 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">{g.label}</p>
						<ul className="space-y-1">
							{tools.map((t) => {
								const frac = t.count / max;
								return (
									<li key={t.tool} className="grid grid-cols-[78px_1fr_26px] items-center gap-x-2">
										<span className="truncate font-mono text-[10px] text-[var(--ret-text-dim)]" title={t.tool}>
											{t.tool}
										</span>
										<span className="relative h-3 bg-[var(--ret-border)]/30" aria-hidden="true">
											<span
												className="absolute inset-y-0 left-0 block"
												style={{
													width: `${Math.max(2, frac * 100)}%`,
													// the named surprises (Pulumi/Rootly/PagerDuty/Jenkins/GitLab)
													// earn the one health hue so the eye lands on them.
													backgroundColor: t.note ? "var(--ret-amber)" : ACCENT,
													opacity: t.note ? 0.95 : 0.55,
												}}
											/>
										</span>
										<span className="text-right font-mono text-[11px] tabular-nums text-[var(--ret-text-dim)]">{t.count}</span>
										{t.note ? (
											<span className="col-span-3 pl-[80px] font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
												<span style={{ color: "var(--ret-amber)" }}>↯</span> {t.note}
											</span>
										) : null}
									</li>
								);
							})}
						</ul>
					</div>
				);
			})}
			<p className="border-t border-[var(--ret-border)] pt-1.5 font-mono text-[9px] leading-snug text-[var(--ret-text-muted)]">
				Amber = surprise called out in the pain synthesis (Pulumi at 51% of Terraform; PagerDuty low vs Rootly).
			</p>
		</div>
	);
}

// --- multi-series stacked-ink time series ----------------------------------
// Hand-rolled SVG (no chart lib). One shared month axis, three tier series drawn
// as overlapping area+line. Tier ordering carries opacity (ink-only encoding).
function TierTimeSeries() {
	const W = 720;
	const H = 150;
	const PAD_L = 28;
	const PAD_B = 18;
	const PAD_T = 12;
	const PAD_R = 6;
	const months = ACTIVITY_MONTHS;
	const n = months.length;

	const allMax = useMemo(() => {
		let m = 0;
		for (const s of TIER_SERIES) for (const v of s.points) m = Math.max(m, v);
		return m || 1;
	}, []);

	const plotW = W - PAD_L - PAD_R;
	const plotH = H - PAD_T - PAD_B;
	const x = (i: number) => PAD_L + (n > 1 ? (i / (n - 1)) * plotW : 0);
	const y = (v: number) => PAD_T + plotH - (v / allMax) * plotH;

	// year gridlines (first month of each year present)
	const yearTicks = useMemo(() => {
		const ticks: { i: number; year: string }[] = [];
		let lastYear = "";
		months.forEach((m, i) => {
			const yr = m.slice(0, 4);
			if (yr !== lastYear) {
				ticks.push({ i, year: yr });
				lastYear = yr;
			}
		});
		return ticks;
	}, [months]);

	// tier ink: later (more cloud-native) tiers read stronger.
	const tierInk: Record<string, number> = { startup: 0.32, sre: 0.62, "sre-cloud": 0.95 };
	const tierLabel: Record<string, string> = { startup: "startup", sre: "sre", "sre-cloud": "sre-cloud" };

	return (
		<div className="space-y-2">
			<div className="overflow-x-auto">
				<svg
					viewBox={`0 0 ${W} ${H}`}
					className="block h-auto w-full min-w-[520px]"
					role="img"
					aria-label={`Posts per month by subreddit tier from ${months[0]} to ${months[n - 1]}, peak ${allMax} posts in a single month.`}
				>
					{/* y gridlines */}
					{[0, 0.5, 1].map((f) => {
						const yy = PAD_T + plotH - f * plotH;
						return (
							<g key={f}>
								<line x1={PAD_L} y1={yy} x2={W - PAD_R} y2={yy} stroke="var(--ret-border)" strokeWidth={0.5} />
								<text x={PAD_L - 4} y={yy + 3} textAnchor="end" className="fill-[var(--ret-text-muted)] font-mono" fontSize={8}>
									{Math.round(f * allMax)}
								</text>
							</g>
						);
					})}
					{/* year ticks */}
					{yearTicks.map((t) => (
						<g key={t.year}>
							<line x1={x(t.i)} y1={PAD_T} x2={x(t.i)} y2={PAD_T + plotH} stroke="var(--ret-border)" strokeWidth={0.5} strokeDasharray="2,3" />
							<text x={x(t.i)} y={H - 5} textAnchor="middle" className="fill-[var(--ret-text-muted)] font-mono" fontSize={8}>
								{t.year}
							</text>
						</g>
					))}
					{/* series */}
					{TIER_SERIES.map((s) => {
						const pts = s.points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
						const area = `M${PAD_L},${PAD_T + plotH} L${pts.replace(/ /g, " L")} L${x(n - 1)},${PAD_T + plotH} Z`;
						const op = tierInk[s.tier] ?? 0.5;
						return (
							<g key={s.tier}>
								<path d={area} fill={ACCENT} fillOpacity={op * 0.1} />
								<polyline points={pts} fill="none" stroke={ACCENT} strokeWidth={1.2} strokeOpacity={op} vectorEffect="non-scaling-stroke" />
							</g>
						);
					})}
					{/* axis label */}
					<text x={PAD_L} y={9} className="fill-[var(--ret-text-muted)] font-mono" fontSize={8}>
						posts / month
					</text>
				</svg>
			</div>
			{/* legend */}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--ret-text-muted)]">
				{TIER_SERIES.map((s) => (
					<span key={s.tier} className="flex items-center gap-1.5">
						<span className="inline-block h-2 w-4" style={{ backgroundColor: ACCENT, opacity: tierInk[s.tier] ?? 0.5 }} aria-hidden="true" />
						{tierLabel[s.tier]}
						<span className="tabular-nums text-[var(--ret-text-dim)]">{s.points.reduce((a, b) => a + b, 0)}</span>
					</span>
				))}
				<span className="text-[var(--ret-text-muted)]">· measured · tier = subreddit grouping (startup / sre / cloud)</span>
			</div>
		</div>
	);
}

// --- sortable leaderboard table --------------------------------------------
function Leaderboard({
	rows,
	sortKey,
	sortDir,
	onSort,
}: {
	rows: VoicePost[];
	sortKey: SortKey;
	sortDir: "asc" | "desc";
	onSort: (k: SortKey) => void;
}) {
	if (!rows.length) {
		return <p className="py-6 text-center font-mono text-[12px] text-[var(--ret-text-muted)]">No posts match these filters.</p>;
	}
	const SortHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
		<th scope="col" className={cn("px-2 py-1.5 font-medium", align === "right" ? "text-right" : "text-left")}>
			<button
				type="button"
				onClick={() => onSort(k)}
				className="inline-flex items-center gap-0.5 uppercase tracking-wide outline-none hover:text-[var(--ret-text)]"
			>
				{label}
				{sortKey === k ? (
					sortDir === "desc" ? (
						<ArrowDown className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
					) : (
						<ArrowUp className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
					)
				) : null}
			</button>
		</th>
	);

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[460px] border-collapse text-left">
				<caption className="sr-only">Curated incident-relevant reddit posts; click a column header to sort.</caption>
				<thead>
					<tr className="border-b border-[var(--ret-border)] font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
						<SortHead k="subreddit" label="sub" />
						<th scope="col" className="px-2 py-1.5 font-medium uppercase tracking-wide">post</th>
						<SortHead k="score" label="score" align="right" />
						<SortHead k="comments" label="cmts" align="right" />
						<th scope="col" className="px-2 py-1.5 text-right font-medium uppercase tracking-wide">open</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((p) => (
						<tr key={p.id} className="border-b border-[var(--ret-border)] last:border-0 hover:bg-[var(--ret-surface)]">
							<td className="px-2 py-1.5 align-top font-mono text-[10px] uppercase text-[var(--ret-text-dim)]">{p.subreddit}</td>
							<td className="px-2 py-1.5 align-top">
								<div className="line-clamp-2 text-[12px] leading-snug text-[var(--ret-text)]">{p.title}</div>
								<div className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">{p.theme}</div>
							</td>
							<td className="px-2 py-1.5 text-right align-top font-mono text-[12px] tabular-nums text-[var(--ret-text)]">{p.score.toLocaleString()}</td>
							<td className="px-2 py-1.5 text-right align-top font-mono text-[11px] tabular-nums text-[var(--ret-text-dim)]">{p.comments}</td>
							<td className="px-2 py-1.5 text-right align-top">
								<a
									href={p.url}
									target="_blank"
									rel="noreferrer"
									aria-label={`Open "${p.title}" on reddit`}
									className="inline-flex text-[var(--ret-blue)] hover:opacity-80"
								>
									<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
								</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// --- buyer quote cards -----------------------------------------------------
function QuoteCards({ quotes }: { quotes: BuyerQuote[] }) {
	if (!quotes.length) {
		return <p className="py-6 text-center font-mono text-[12px] text-[var(--ret-text-muted)]">No quotes match these filters.</p>;
	}
	return (
		<ul className="space-y-2">
			{quotes.map((q, i) => (
				<li key={i} className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
					<div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">
						<span className="flex items-center gap-1.5">
							<span className="text-[var(--ret-text-dim)]">r/{q.subreddit}</span>
							<span className="border border-[var(--ret-border)] px-1 text-[var(--ret-text-muted)]">{q.keyword}</span>
						</span>
						<span className="tabular-nums text-[var(--ret-text-dim)]">{q.score.toLocaleString()}↑</span>
					</div>
					<div className="mt-1.5 flex gap-1.5">
						<MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ret-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
						<p className="text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{q.body}</p>
					</div>
					<a
						href={q.url}
						target="_blank"
						rel="noreferrer"
						className="mt-1.5 line-clamp-1 inline-flex items-center gap-1 font-mono text-[9px] text-[var(--ret-blue)] hover:underline"
					>
						<ExternalLink className="h-2.5 w-2.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
						{q.postTitle}
					</a>
				</li>
			))}
		</ul>
	);
}

// --- shared instrument shell -----------------------------------------------
function Panel({ title, hint, className, children }: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
				active
					? "border-[var(--ret-accent)] bg-[var(--ret-accent)] text-[var(--ret-bg)]"
					: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
			)}
		>
			{children}
		</button>
	);
}
