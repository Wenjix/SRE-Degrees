"use client";

import type { ReactNode } from "react";

import { ReticleMark } from "@/components/ReticleMark";
import { ReticleFrameProvider } from "@/components/reticle";
import { BRAND, NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/cn";

import { DASHBOARD_SHELL_HEADER_ROW } from "./chrome";
import { SidebarNav } from "./SidebarNav";
import { StatusHeader } from "./StatusHeader";

export function DashboardShell({ children }: { children: ReactNode }) {
	return (
		<ReticleFrameProvider corners={false}>
			<div className="relative grid min-h-[100dvh] bg-[var(--ret-bg-soft)] lg:grid-cols-[220px_1fr]">
				<aside className="sticky top-0 z-10 hidden h-[100dvh] self-start border-r border-[var(--ret-border)] bg-[var(--ret-bg)] lg:flex lg:flex-col">
					<div className={cn(DASHBOARD_SHELL_HEADER_ROW, "bg-[var(--ret-bg)] px-3")}>
						<a
							href="/dashboard"
							className="flex min-w-0 items-center gap-2 text-[var(--ret-text)] transition-colors hover:text-[var(--ret-accent)]"
							aria-label={`${BRAND.name} dashboard`}
						>
							<ReticleMark size={18} />
							<span className="truncate text-[15px] font-semibold">
								{BRAND.wordmark}
							</span>
						</a>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<SidebarNav sections={NAV_SECTIONS} />
					</div>
				</aside>
				<div className="relative z-10 flex h-[100dvh] min-w-0 flex-col bg-[var(--ret-bg)]">
					<StatusHeader />
					<div className="border-b border-[var(--ret-border)] bg-[var(--ret-bg)] lg:hidden">
						<SidebarNav sections={NAV_SECTIONS} compact />
					</div>
					<main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
				</div>
			</div>
		</ReticleFrameProvider>
	);
}
