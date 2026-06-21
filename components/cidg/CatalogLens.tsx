"use client";

import { useMemo, useState } from "react";

import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/cn";
import { CIDG_INCIDENTS, type CidgIncident } from "@/lib/cidg/catalog";
import { TRUST_TIER_COLOR, TRUST_TIER_LABEL, difficultyColor, type TrustTier } from "@/lib/cidg/shared";

type KindFilter = "all" | "real" | "synthetic";
type TierFilter = "all" | TrustTier;

function severityColor(s: string): string {
	if (s.includes("crit")) return "var(--ret-red)";
	if (s.includes("warn") || s.includes("major")) return "var(--ret-amber)";
	return "var(--ret-text-dim)";
}

function DifficultyPips({ d }: { d: number }) {
	return (
		<span className="inline-flex items-center gap-0.5" title={`difficulty ${d}/5`} aria-label={`difficulty ${d} of 5`}>
			{[1, 2, 3, 4, 5].map((i) => (
				<span
					key={i}
					className="h-2 w-2"
					style={{ backgroundColor: i <= d ? difficultyColor(d) : "var(--ret-border)" }}
				/>
			))}
		</span>
	);
}

function Chip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
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

// CATALOG — the 34-incident library (19 reconstructed real outages + 15 synthetic
// CIDG scenarios). The whole point is browsing by category/company and expanding
// the loud-symptom-vs-true-root and naive-fix-vs-correct-fix contrast per incident.
export function CatalogLens() {
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<KindFilter>("all");
	const [category, setCategory] = useState<string>("all");
	const [tier, setTier] = useState<TierFilter>("all");
	const [selectedId, setSelectedId] = useState<string | null>(CIDG_INCIDENTS[0]?.id ?? null);

	const categories = useMemo(() => {
		const counts = new Map<string, number>();
		for (const inc of CIDG_INCIDENTS) counts.set(inc.rootCauseCategory, (counts.get(inc.rootCauseCategory) ?? 0) + 1);
		return [...counts.entries()].sort((a, b) => b[1] - a[1]);
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return CIDG_INCIDENTS.filter((inc) => {
			if (kind !== "all" && inc.kind !== kind) return false;
			if (category !== "all" && inc.rootCauseCategory !== category) return false;
			if (tier !== "all" && inc.trustTier !== tier) return false;
			if (!q) return true;
			return (
				inc.title.toLowerCase().includes(q) ||
				inc.loudSymptom.toLowerCase().includes(q) ||
				inc.rootCauseSubtype.toLowerCase().includes(q) ||
				inc.failureMode.toLowerCase().includes(q) ||
				(inc.sourceCompany ?? "").toLowerCase().includes(q)
			);
		});
	}, [query, kind, category, tier]);

	const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* header + filters */}
			<div className="shrink-0 border-b border-[var(--ret-border)] bg-[var(--ret-bg)] px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<div className="min-w-0">
						<p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Incident catalog</p>
						<h1 className="ret-display text-[16px]">
							Loud symptom <span className="text-[var(--ret-text-muted)]">vs.</span> true root cause
						</h1>
					</div>
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="search incidents…"
						aria-label="Search incidents"
						className="h-7 w-[200px] border border-[var(--ret-border)] bg-[var(--ret-bg)] px-2 font-mono text-[12px] outline-none focus:border-[var(--ret-accent)]"
					/>
				</div>

				<div className="mt-2.5 flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">kind</span>
					<Chip active={kind === "all"} onClick={() => setKind("all")}>all {CIDG_INCIDENTS.length}</Chip>
					<Chip active={kind === "real"} onClick={() => setKind("real")}>
						real {CIDG_INCIDENTS.filter((i) => i.kind === "real").length}
					</Chip>
					<Chip active={kind === "synthetic"} onClick={() => setKind("synthetic")}>
						synthetic {CIDG_INCIDENTS.filter((i) => i.kind === "synthetic").length}
					</Chip>
					<span className="mx-1 h-3.5 w-px bg-[var(--ret-border)]" aria-hidden="true" />
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">tier</span>
					<Chip active={tier === "all"} onClick={() => setTier("all")}>any</Chip>
					{(["autonomous", "approval", "blocked"] as TrustTier[]).map((t) => (
						<Chip key={t} active={tier === t} onClick={() => setTier(t)}>
							{TRUST_TIER_LABEL[t]}
						</Chip>
					))}
				</div>

				<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
					<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">root cause</span>
					<Chip active={category === "all"} onClick={() => setCategory("all")}>any</Chip>
					{categories.map(([cat, n]) => (
						<Chip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
							{cat.replace(/_/g, " ")} {n}
						</Chip>
					))}
				</div>
			</div>

			{/* master / detail */}
			<div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_380px]">
				{/* card grid */}
				<div className="min-h-0 overflow-auto p-3">
					<p className="mb-2 px-1 font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
						{filtered.length} incident{filtered.length === 1 ? "" : "s"}
					</p>
					{filtered.length === 0 ? (
						<p className="px-1 py-8 text-center font-mono text-[12px] text-[var(--ret-text-muted)]">No incidents match these filters.</p>
					) : (
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
							{filtered.map((inc) => (
								<IncidentCard
									key={inc.id}
									inc={inc}
									selected={selected?.id === inc.id}
									onSelect={() => setSelectedId(inc.id)}
								/>
							))}
						</div>
					)}
				</div>

				{/* detail */}
				<aside className="min-h-0 overflow-auto border-t border-[var(--ret-border)] bg-[var(--ret-bg-soft)] xl:border-l xl:border-t-0">
					{selected ? <IncidentDetail inc={selected} /> : null}
				</aside>
			</div>
		</div>
	);
}

function IncidentCard({
	inc,
	selected,
	onSelect,
}: {
	inc: CidgIncident;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={selected}
			className={cn(
				"flex flex-col gap-2 border p-3 text-left outline-none transition-colors focus-visible:border-[var(--ret-accent)]",
				selected
					? "border-[var(--ret-accent)] bg-[var(--ret-accent-glow)]"
					: "border-[var(--ret-border)] bg-[var(--ret-bg)] hover:border-[var(--ret-border-hover)]",
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="truncate text-[13px] font-semibold leading-tight">{inc.title}</div>
					<div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
						{inc.kind === "real" ? (
							<span className="text-[var(--ret-text-dim)]">{inc.sourceCompany}</span>
						) : (
							<span>synthetic</span>
						)}
						<span>·</span>
						<span>{inc.rootCauseCategory.replace(/_/g, " ")}</span>
					</div>
				</div>
				<DifficultyPips d={inc.difficulty} />
			</div>

			{/* the signature contrast: naive fix worsens it / correct fix */}
			<div className="grid grid-cols-2 gap-px border border-[var(--ret-border)] bg-[var(--ret-border)]">
				<div className="bg-[var(--ret-bg)] p-1.5">
					<p className="font-mono text-[8px] uppercase tracking-wide" style={{ color: "var(--ret-red)" }}>
						naive fix → worse
					</p>
					<p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-[var(--ret-text-dim)]">{inc.trap || "—"}</p>
				</div>
				<div className="bg-[var(--ret-bg)] p-1.5">
					<p className="font-mono text-[8px] uppercase tracking-wide" style={{ color: "var(--ret-green)" }}>
						correct fix
					</p>
					<p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-[var(--ret-text-dim)]">{inc.correctFix || "—"}</p>
				</div>
			</div>

			<div className="flex items-center justify-between gap-2 font-mono text-[9px]">
				<span className="truncate text-[var(--ret-text-muted)]">{inc.fixTool}</span>
				<span style={{ color: TRUST_TIER_COLOR[inc.trustTier] }}>{TRUST_TIER_LABEL[inc.trustTier]}</span>
			</div>
		</button>
	);
}

function Block({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
	return (
		<div className="border border-[var(--ret-border)] bg-[var(--ret-bg)] p-2.5">
			<p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: color ?? "var(--ret-text-muted)" }}>
				{label}
			</p>
			<div className="mt-1 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{children}</div>
		</div>
	);
}

function IncidentDetail({ inc }: { inc: CidgIncident }) {
	return (
		<div className="space-y-2.5 p-3">
			<div>
				<div className="flex items-start justify-between gap-2">
					<h2 className="text-[15px] font-semibold leading-tight">{inc.title}</h2>
					<DifficultyPips d={inc.difficulty} />
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
					<span
						className="border px-1"
						style={{ borderColor: "var(--ret-border)", color: inc.kind === "real" ? "var(--ret-text-dim)" : "var(--ret-text-muted)" }}
					>
						{inc.kind}
					</span>
					{inc.sourceCompany ? <span className="text-[var(--ret-text-dim)]">{inc.sourceCompany}</span> : null}
					<span>·</span>
					<span style={{ color: severityColor(inc.severity) }}>{inc.severity}</span>
					<span>·</span>
					<span>{inc.rootCauseCategory.replace(/_/g, " ")}</span>
				</div>
				{inc.sourceUrl ? (
					<a
						href={inc.sourceUrl}
						target="_blank"
						rel="noreferrer"
						className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--ret-blue)] hover:underline"
					>
						<ExternalLink className="h-3 w-3" strokeWidth={1.75} />
						postmortem source
					</a>
				) : null}
			</div>

			<Block label="Loud symptom — what the alert screams">{inc.loudSymptom || "—"}</Block>
			<Block label="True root cause" color="var(--ret-text)">
				{inc.rootCauseSubtype || inc.failureMode}
			</Block>

			<div className="grid grid-cols-1 gap-px border border-[var(--ret-border)] bg-[var(--ret-border)]">
				<div className="bg-[var(--ret-bg)] p-2.5">
					<p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--ret-red)" }}>
						The trap — naive fix that worsens it
					</p>
					<p className="mt-1 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{inc.trap || "—"}</p>
				</div>
				<div className="bg-[var(--ret-bg)] p-2.5">
					<p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--ret-green)" }}>
						Correct fix
					</p>
					<p className="mt-1 text-[12px] leading-relaxed text-[var(--ret-text-dim)]">{inc.correctFix || "—"}</p>
					<div className="mt-1.5 flex items-center gap-2 font-mono text-[10px]">
						<span className="text-[var(--ret-text-muted)]">tool</span>
						<span className="text-[var(--ret-text)]">{inc.fixTool}</span>
						<span className="text-[var(--ret-text-muted)]">·</span>
						<span style={{ color: TRUST_TIER_COLOR[inc.trustTier] }}>{TRUST_TIER_LABEL[inc.trustTier]}</span>
					</div>
				</div>
			</div>

			{inc.adversarialSignals.length ? (
				<Block label="Why it misleads — adversarial signals">
					<ul className="space-y-1.5">
						{inc.adversarialSignals.map((s, i) => (
							<li key={i} className="flex gap-1.5">
								<span style={{ color: "var(--ret-amber)" }}>↯</span>
								<span>{s}</span>
							</li>
						))}
					</ul>
				</Block>
			) : null}

			{inc.redHerrings.length ? (
				<Block label="Red herrings ruled out">
					<ul className="flex flex-wrap gap-1">
						{inc.redHerrings.map((s, i) => (
							<li key={i} className="border border-[var(--ret-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ret-text-muted)] line-through">
								{s}
							</li>
						))}
					</ul>
				</Block>
			) : null}

			{inc.requiredKeywords.length ? (
				<Block label="Must identify — diagnosis keys">
					<ul className="flex flex-wrap gap-1">
						{inc.requiredKeywords.map((s, i) => (
							<li key={i} className="border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ret-text-dim)]">
								{s}
							</li>
						))}
					</ul>
				</Block>
			) : null}
		</div>
	);
}
