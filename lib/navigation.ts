export const BRAND = {
	name: "SRE Promotion Engine",
	wordmark: "sre-promotion-engine",
	shortName: "SPE",
	themeStorageKey: "sre-promotion-engine.theme",
} as const;

export type IconName =
	| "activity"
	| "barChart"
	| "command"
	| "flask"
	| "folder"
	| "layout"
	| "settings"
	| "sparkles";

export type NavBadge = "live" | "new";

export type NavItem = {
	href: string;
	label: string;
	icon: IconName;
	keywords: string;
	exact?: boolean;
	badge?: NavBadge;
};

export type NavSection = {
	id: string;
	label: string;
	hint: string;
	items: readonly NavItem[];
};

export const NAV_SECTIONS: readonly NavSection[] = [
	{
		id: "operate",
		label: "Operate",
		hint: "daily loop",
		items: [
			{
				href: "/dashboard",
				label: "Overview",
				icon: "layout",
				keywords: "home dashboard overview metrics activity",
				exact: true,
			},
			{
				href: "/dashboard/projects",
				label: "Projects",
				icon: "folder",
				keywords: "projects workspaces queues runs",
				badge: "live",
			},
		],
	},
	{
		id: "lab",
		label: "Lab",
		hint: "experiment data",
		items: [
			{
				href: "/dashboard/lab",
				label: "CIDG Lab",
				icon: "flask",
				keywords:
					"cidg incident rl environment catalog leaderboard cascade trajectory reward frontier reddit research",
				badge: "new",
			},
		],
	},
	{
		id: "system",
		label: "System",
		hint: "kit and config",
		items: [
			{
				href: "/dashboard/settings",
				label: "Settings",
				icon: "settings",
				keywords: "settings preferences theme configuration",
			},
		],
	},
] as const;

export type StatusTone = "neutral" | "ok" | "warn" | "error" | "info";

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
	neutral:
		"border-[var(--ret-border)] bg-[var(--ret-surface)] text-[var(--ret-text-dim)]",
	ok: "border-[var(--ret-green)]/40 bg-[var(--ret-green)]/10 text-[var(--ret-green)]",
	warn: "border-[var(--ret-amber)]/40 bg-[var(--ret-amber)]/10 text-[var(--ret-amber)]",
	error: "border-[var(--ret-red)]/40 bg-[var(--ret-red)]/10 text-[var(--ret-red)]",
	info: "border-[var(--ret-blue)]/40 bg-[var(--ret-blue)]/10 text-[var(--ret-blue)]",
};

export type CommandGroup = "navigate" | "entities" | "actions";

export type Command = {
	id: string;
	group: CommandGroup;
	label: string;
	hint?: string;
	keywords: string;
	href: string;
};

export type CommandEntity = {
	id: string;
	name: string;
	status: string;
	href: string;
	keywords: string;
};

export function flattenNavItems(
	sections: readonly NavSection[] = NAV_SECTIONS,
): NavItem[] {
	return sections.flatMap((section) => section.items);
}

export function isNavActive(pathname: string, item: NavItem): boolean {
	if (item.exact) return pathname === item.href;
	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function buildCommands({
	sections = NAV_SECTIONS,
	entities = [],
}: {
	sections?: readonly NavSection[];
	entities?: readonly CommandEntity[];
} = {}): Command[] {
	const navCommands = flattenNavItems(sections).map(
		(item): Command => ({
			id: `nav:${item.href}`,
			group: "navigate",
			label: item.label,
			keywords: item.keywords,
			href: item.href,
		}),
	);
	const entityCommands = entities.map(
		(entity): Command => ({
			id: `entity:${entity.id}`,
			group: "entities",
			label: entity.name,
			hint: entity.status,
			keywords: `${entity.id} ${entity.keywords} ${entity.status}`,
			href: entity.href,
		}),
	);
	return [
		...navCommands,
		...entityCommands,
		{
			id: "action:new-project",
			group: "actions",
			label: "Create project",
			href: "/dashboard/projects",
			keywords: "new create project workspace",
		},
	];
}

export function fuzzyScore(query: string, haystack: string): number | null {
	const q = query.trim().toLowerCase();
	if (!q) return 0;
	const h = haystack.toLowerCase();
	const sub = h.indexOf(q);
	if (sub !== -1) {
		const prevChar = sub === 0 ? "" : h[sub - 1];
		const boundary = sub === 0 || /[\s\-_/.:]/.test(prevChar);
		return 600 + (boundary ? 200 : 0) - sub;
	}
	let hi = 0;
	let matched = 0;
	let contiguous = 0;
	let bestRun = 0;
	for (const ch of q) {
		let found = -1;
		for (let j = hi; j < h.length; j += 1) {
			if (h[j] === ch) {
				found = j;
				break;
			}
		}
		if (found === -1) return null;
		contiguous = found === hi ? contiguous + 1 : 0;
		bestRun = Math.max(bestRun, contiguous);
		matched += 1;
		hi = found + 1;
	}
	return 100 + matched + bestRun * 2;
}

export function scoreCommand(query: string, command: Command): number | null {
	const q = query.trim().toLowerCase();
	if (!q) return 0;
	const label = fuzzyScore(q, command.label);
	const aux = `${command.hint ?? ""} ${command.keywords}`.toLowerCase();
	const auxIdx = aux.indexOf(q);
	const auxScore = auxIdx === -1 ? null : 300 - auxIdx;
	if (label === null && auxScore === null) return null;
	return Math.max(label ?? 0, (auxScore ?? 0) * 0.6);
}

export function filterCommands(
	commands: readonly Command[],
	query: string,
): Command[] {
	const q = query.trim();
	if (!q) return [...commands];
	return commands
		.map((command) => ({ command, score: scoreCommand(q, command) }))
		.filter((entry): entry is { command: Command; score: number } => entry.score !== null)
		.sort((a, b) => b.score - a.score)
		.map((entry) => entry.command);
}
