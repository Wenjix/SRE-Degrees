"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavSection } from "@/lib/navigation";
import { isNavActive } from "@/lib/navigation";
import { cn } from "@/lib/cn";

import { ICONS } from "./icons";

export function SidebarNav({
	sections,
	compact = false,
}: {
	sections: readonly NavSection[];
	compact?: boolean;
}) {
	const pathname = usePathname();

	if (compact) {
		return (
			<nav
				aria-label="Mobile dashboard"
				className="flex gap-1 overflow-x-auto px-3 py-2 text-[12px]"
			>
				{sections.flatMap((section) =>
					section.items.map((item) => {
						const Icon = ICONS[item.icon];
						const active = isNavActive(pathname, item);
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex shrink-0 items-center gap-2 border px-3 py-1.5 transition-colors",
									active
										? "border-[var(--ret-accent)]/45 bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]"
										: "border-[var(--ret-border)] text-[var(--ret-text-dim)] hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]",
								)}
							>
								<Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
								<span>{item.label}</span>
							</Link>
						);
					}),
				)}
			</nav>
		);
	}

	return (
		<nav
			aria-label="Dashboard"
			className="flex flex-col gap-5 px-3 pb-6 pt-4 text-[13px]"
		>
			{sections.map((section) => (
				<Section key={section.id} section={section} pathname={pathname} />
			))}
		</nav>
	);
}

function Section({
	section,
	pathname,
}: {
	section: NavSection;
	pathname: string;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-baseline justify-between gap-2 px-3 pb-1.5">
				<p className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">
					{section.label}
				</p>
				<p className="text-[10px] italic text-[var(--ret-text-muted)]">
					{section.hint}
				</p>
			</div>
			{section.items.map((item) => {
				const Icon = ICONS[item.icon];
				const active = isNavActive(pathname, item);
				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"group relative flex items-center gap-3 px-3 py-1.5 transition-colors",
							active
								? "bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]"
								: "text-[var(--ret-text-dim)] hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]",
						)}
					>
						<span
							aria-hidden="true"
							className={cn(
								"absolute inset-y-0 left-0 w-px",
								active ? "bg-[var(--ret-accent)]" : "bg-transparent",
							)}
						/>
						<Icon
							strokeWidth={1.75}
							className={cn(
								"h-3.5 w-3.5 shrink-0",
								active
									? "text-[var(--ret-accent)]"
									: "text-[var(--ret-text-muted)] group-hover:text-[var(--ret-text-dim)]",
							)}
						/>
						<span className="flex-1 truncate">{item.label}</span>
						{item.badge ? <NavBadge badge={item.badge} /> : null}
					</Link>
				);
			})}
		</div>
	);
}

function NavBadge({ badge }: { badge: "live" | "new" }) {
	if (badge === "live") {
		return (
			<span className="flex shrink-0 items-center gap-1 text-[9px] uppercase text-[var(--ret-text-muted)]">
				<span aria-hidden="true" className="h-1 w-1 animate-pulse bg-[var(--ret-green)]" />
				live
			</span>
		);
	}
	return (
		<span className="shrink-0 border border-[var(--ret-accent)]/30 px-1 py-0 text-[9px] uppercase text-[var(--ret-accent)]">
			new
		</span>
	);
}
