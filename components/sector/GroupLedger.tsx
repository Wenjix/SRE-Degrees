"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";

import { useLens } from "./LensProvider";
import { deriveGroups, type AgentGroup } from "./spatial";
import { STATUS_COLOR_VAR } from "./visual";

// Right-rail projection of the live proximity clustering. Bidirectional: click a
// group to frame it across views; rename sticks; the worst child rolls up.
export function GroupLedger({ className }: { className?: string }) {
	const { state, select, focusZone, renameGroup } = useLens();
	const groups = useMemo(() => deriveGroups(state.agents, state.groupNames), [state.agents, state.groupNames]);

	return (
		<div className={cn("flex h-full flex-col", className)}>
			<div className="flex items-center justify-between border-b border-[var(--ret-border)] px-3 py-2">
				<span className="font-mono text-[10px] uppercase tracking-wide text-[var(--ret-text-muted)]">Group ledger</span>
				<span className="font-mono text-[10px] text-[var(--ret-text-muted)]">{groups.length}</span>
			</div>
			<div className="min-h-0 flex-1 divide-y divide-[var(--ret-border)] overflow-y-auto">
				{groups.map((group) => (
					<GroupRow
						key={group.key}
						group={group}
						selectedId={state.selectedId}
						onFrame={() => {
							focusZone(group.zone);
							if (group.members[0]) select(group.members[0].id);
						}}
						onSelectMember={(id) => {
							focusZone(group.zone);
							select(id);
						}}
						onRename={(name) => renameGroup(group.key, name)}
					/>
				))}
			</div>
		</div>
	);
}

function GroupRow({
	group,
	selectedId,
	onFrame,
	onSelectMember,
	onRename,
}: {
	group: AgentGroup;
	selectedId: string | null;
	onFrame: () => void;
	onSelectMember: (id: string) => void;
	onRename: (name: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(group.label);

	const commit = () => {
		const v = draft.trim();
		if (v) onRename(v);
		setEditing(false);
	};

	return (
		<div className="px-3 py-2">
			<div className="flex items-center gap-2">
				<span
					className="h-2 w-2 shrink-0"
					style={{ background: STATUS_COLOR_VAR[group.worst] }}
					aria-hidden="true"
				/>
				{editing ? (
					<input
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") commit();
							if (e.key === "Escape") {
								setDraft(group.label);
								setEditing(false);
							}
						}}
						className="h-5 min-w-0 flex-1 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-1 font-mono text-[11px] outline-none focus:border-[var(--ret-accent)]"
						aria-label="Rename group"
					/>
				) : (
					<button
						type="button"
						onClick={onFrame}
						onDoubleClick={() => {
							setDraft(group.label);
							setEditing(true);
						}}
						title="Click to frame · double-click to rename"
						className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-[var(--ret-text)] transition-colors hover:text-[var(--ret-accent)]"
					>
						{group.label}
					</button>
				)}
				<span className="shrink-0 font-mono text-[10px] text-[var(--ret-text-muted)]">{group.members.length}</span>
			</div>
			<div className="mt-1 flex flex-wrap gap-1 pl-4">
				{group.members.map((m) => (
					<button
						key={m.id}
						type="button"
						onClick={() => onSelectMember(m.id)}
						className={cn(
							"border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
							selectedId === m.id
								? "border-[var(--ret-border-strong)] text-[var(--ret-text)]"
								: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:text-[var(--ret-text)]",
						)}
					>
						<span className="mr-1 inline-block h-1.5 w-1.5 align-middle" style={{ background: STATUS_COLOR_VAR[m.status] }} aria-hidden="true" />
						{m.name}
					</button>
				))}
			</div>
		</div>
	);
}
