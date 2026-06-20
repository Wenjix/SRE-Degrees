import { CheckCircle2, CircleAlert, Clock3, Pause } from "lucide-react";

import { DashboardPageBody } from "@/components/dashboard/DashboardPageBody";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ReticleBadge, ReticleButton, ReticleLabel } from "@/components/reticle";
import { projects, type ProjectStatus } from "@/lib/demo-data";

const STATUS_ICON = {
	running: CheckCircle2,
	queued: Clock3,
	blocked: CircleAlert,
	idle: Pause,
} satisfies Record<ProjectStatus, typeof CheckCircle2>;

export default function ProjectsPage() {
	return (
		<>
			<PageHeader
				kicker="Projects"
				title="Neutral project console"
				description="Use this page as the first domain replacement point. Swap the demo project array with your own adapter and keep the shell intact."
				right={<ReticleBadge variant="accent">local data</ReticleBadge>}
			/>
			<DashboardPageBody>
				<DashboardPanel>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ret-border)] px-4 py-3">
						<div>
							<ReticleLabel>Workspace</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Project queue</h2>
						</div>
						<ReticleButton variant="secondary" size="sm">
							New project
						</ReticleButton>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[760px] border-collapse">
							<thead>
								<tr className="border-b border-[var(--ret-border)] bg-[var(--ret-bg-soft)] text-left font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
									<th className="px-4 py-2 font-medium">Project</th>
									<th className="px-4 py-2 font-medium">Owner</th>
									<th className="px-4 py-2 font-medium">Status</th>
									<th className="px-4 py-2 font-medium">Runs</th>
									<th className="px-4 py-2 font-medium">Success</th>
									<th className="px-4 py-2 font-medium">Budget</th>
									<th className="px-4 py-2 font-medium">Trend</th>
								</tr>
							</thead>
							<tbody>
								{projects.map((project) => {
									const Icon = STATUS_ICON[project.status];
									return (
										<tr
											key={project.id}
											className="border-b border-[var(--ret-border)] last:border-0"
										>
											<td className="px-4 py-3">
												<div className="flex min-w-0 items-start gap-3">
													<span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] text-[var(--ret-text-dim)]">
														<Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
													</span>
													<div className="min-w-0">
														<p className="truncate text-[13px] font-semibold">
															{project.name}
														</p>
														<p className="mt-1 max-w-[44ch] truncate text-[12px] text-[var(--ret-text-dim)]">
															{project.description}
														</p>
													</div>
												</div>
											</td>
											<td className="px-4 py-3 font-mono text-[11px] text-[var(--ret-text-dim)]">
												{project.owner}
											</td>
											<td className="px-4 py-3">
												<StatusPill label={project.status} tone={project.tone} pulse={project.status === "running"} />
											</td>
											<td className="px-4 py-3 font-mono text-[12px] tabular-nums">
												{project.runs}
											</td>
											<td className="px-4 py-3 font-mono text-[12px] tabular-nums">
												{project.successRate}%
											</td>
											<td className="px-4 py-3 font-mono text-[12px]">
												{project.budget}
											</td>
											<td className="px-4 py-3">
												<Sparkline
													values={[
														project.successRate - 9,
														project.successRate - 4,
														project.successRate - 2,
														project.successRate,
													]}
													width={96}
													stroke="var(--ret-accent)"
													ariaLabel={`${project.name} success trend`}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</DashboardPanel>
			</DashboardPageBody>
		</>
	);
}
