import { DashboardPageBody } from "@/components/dashboard/DashboardPageBody";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ReticleBadge, ReticleLabel, ReticleSelect } from "@/components/reticle";
import { settingsRows } from "@/lib/demo-data";

export default function SettingsPage() {
	return (
		<>
			<PageHeader
				kicker="Settings"
				title="Starter configuration"
				description="This page documents the current local-only defaults and shows the controls expected in a real console."
				right={<ReticleBadge>No auth</ReticleBadge>}
			/>
			<DashboardPageBody>
				<div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Defaults</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Runtime assumptions</h2>
						</div>
						<div className="divide-y divide-[var(--ret-border)]">
							{settingsRows.map((row) => (
								<div key={row.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[160px_1fr]">
									<p className="font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
										{row.key}
									</p>
									<div>
										<p className="text-[13px] font-medium text-[var(--ret-text)]">
											{row.value}
										</p>
										<p className="mt-1 text-[12px] text-[var(--ret-text-dim)]">
											{row.note}
										</p>
									</div>
								</div>
							))}
						</div>
					</DashboardPanel>

					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Controls</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Example form chrome</h2>
						</div>
						<div className="space-y-4 p-4">
							<label className="block">
								<span className="mb-1.5 block font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
									Environment
								</span>
								<ReticleSelect className="w-full" defaultValue="local">
									<option value="local">Local demo</option>
									<option value="staging">Staging</option>
									<option value="production">Production</option>
								</ReticleSelect>
							</label>
							<label className="block">
								<span className="mb-1.5 block font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
									Data adapter
								</span>
								<input
									defaultValue="lib/demo-data.ts"
									className="h-8 w-full border border-[var(--ret-border)] bg-[var(--ret-bg)] px-2 font-mono text-[12px] outline-none focus:border-[var(--ret-accent)]"
								/>
							</label>
							<div className="border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] p-3 text-[12px] text-[var(--ret-text-dim)]">
								Replace this panel with real account, team, integration, or API key controls when the product domain is known.
							</div>
						</div>
					</DashboardPanel>
				</div>
				<EmptyState
					title="No external integrations configured"
					description="SRE Promotion Engine intentionally starts with local data only. Add integration adapters after the domain model is settled."
					hint="interface Adapter { listProjects(): Promise<Project[]> }"
				/>
			</DashboardPageBody>
		</>
	);
}
