"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ReticleMark } from "@/components/ReticleMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BRAND, flattenNavItems } from "@/lib/navigation";
import { cn } from "@/lib/cn";

import { DASHBOARD_SHELL_HEADER_ROW, headerDivider } from "./chrome";
import { CommandPalette } from "./CommandPalette";
import { StatusPill } from "./StatusPill";

const CRUMBS = new Map(
	flattenNavItems().map((item) => [item.href, item.label] as const),
);

export function StatusHeader() {
	const pathname = usePathname();
	const label = CRUMBS.get(pathname) ?? "Console";

	return (
		<header
			className={cn(
				DASHBOARD_SHELL_HEADER_ROW,
				"sticky top-0 z-40 justify-between gap-3 bg-[var(--ret-bg)]/90 px-4 backdrop-blur-md md:px-5",
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<Link
					href="/dashboard"
					className="shrink-0 transition-opacity hover:opacity-80 lg:hidden"
					aria-label={`${BRAND.name} home`}
				>
					<ReticleMark size={20} />
				</Link>
				<nav
					aria-label="Dashboard location"
					className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--ret-text-dim)]"
				>
					<Link
						href="/dashboard"
						className="hidden text-[var(--ret-text-muted)] transition-colors hover:text-[var(--ret-text)] sm:inline"
					>
						{BRAND.name}
					</Link>
					<span className="hidden text-[var(--ret-text-muted)] sm:inline" aria-hidden>
						/
					</span>
					<span className="truncate font-medium text-[var(--ret-text)]">
						{label}
					</span>
				</nav>
				<StatusPill label="Local demo" tone="info" pulse className="hidden sm:inline-flex" />
				<div className="ml-1 hidden shrink-0 sm:block">
					<CommandPalette />
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<StatusPill label="No auth" tone="neutral" className="hidden md:inline-flex" />
				<span className={headerDivider} aria-hidden />
				<ThemeToggle />
			</div>
		</header>
	);
}
