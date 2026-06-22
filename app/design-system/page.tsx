import { Activity, ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { DashboardPageBody } from "@/components/dashboard/DashboardPageBody";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { BrailleSpinner } from "@/components/ui/BrailleSpinner";
import {
	ReticleBadge,
	ReticleButton,
	ReticleCard,
	ReticleFrame,
	ReticleLabel,
	ReticleSelect,
} from "@/components/reticle";
import { AgentCard } from "@/components/sector/AgentCard";
import { ErrorBudgetArc } from "@/components/sector/ErrorBudgetArc";
import { HeartbeatDot } from "@/components/sector/HeartbeatDot";
import { agents, CARD_H, CARD_W } from "@/lib/sre-data";

const atlas = agents.find((a) => a.id === "sre-7f2a")!;
const pan = agents.find((a) => a.id === "sre-3a07")!;
const nyx = agents.find((a) => a.id === "sre-9c1f")!;

export default function DesignSystemPage() {
	return (
		<>
			<PageHeader
				kicker="Design system"
				title="SRE Promotion Engine primitives"
				description="A compact inventory of the tokens, controls, loading states, panels, and status treatments used by the promotion console."
				right={<ReticleBadge variant="accent">v0.1</ReticleBadge>}
			/>
			<DashboardPageBody>
				<div className="grid gap-4 xl:grid-cols-2">
					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Buttons</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Action variants</h2>
						</div>
						<div className="flex flex-wrap gap-2 p-4">
							<ReticleButton size="sm">Run</ReticleButton>
							<ReticleButton variant="secondary" size="sm">
								Inspect
							</ReticleButton>
							<ReticleButton variant="ghost" size="sm">
								Cancel
							</ReticleButton>
							<ReticleButton size="sm">
								Next
								<ArrowRight className="h-3.5 w-3.5" />
							</ReticleButton>
						</div>
					</DashboardPanel>

					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Status</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Operational tones</h2>
						</div>
						<div className="flex flex-wrap gap-2 p-4">
							<StatusPill label="running" tone="ok" pulse />
							<StatusPill label="queued" tone="warn" />
							<StatusPill label="blocked" tone="error" />
							<StatusPill label="local" tone="info" />
							<StatusPill label="idle" tone="neutral" />
						</div>
					</DashboardPanel>
				</div>

				<DashboardPanel variant="cellGrid">
					<div className="grid gap-px md:grid-cols-3">
						<MetricCard
							label="Availability"
							value="99.98%"
							hint="30d rolling"
							tone="ok"
							icon={<CheckCircle2 className="h-3 w-3" />}
						/>
						<MetricCard
							label="Latency"
							value="184 ms"
							hint="p50"
							icon={<Activity className="h-3 w-3" />}
						/>
						<MetricCard
							label="Open risks"
							value="1"
							hint="needs owner"
							tone="error"
							icon={<CircleAlert className="h-3 w-3" />}
						/>
					</div>
				</DashboardPanel>

				<div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Inputs</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Form controls</h2>
						</div>
						<div className="grid gap-3 p-4">
							<ReticleSelect defaultValue="compact">
								<option value="compact">Compact</option>
								<option value="comfortable">Comfortable</option>
							</ReticleSelect>
							<input
								placeholder="Search projects"
								className="h-8 border border-[var(--ret-border)] bg-[var(--ret-bg)] px-2 text-[12px] outline-none focus:border-[var(--ret-accent)]"
							/>
							<div className="flex items-center gap-3">
								<BrailleSpinner name="scan" label="loading" className="text-[12px] text-[var(--ret-text-muted)]" />
								<Skeleton width={140} height={24} />
							</div>
						</div>
					</DashboardPanel>

					<DashboardPanel>
						<div className="border-b border-[var(--ret-border)] px-4 py-3">
							<ReticleLabel>Surfaces</ReticleLabel>
							<h2 className="mt-1 text-[15px] font-semibold">Frames and charts</h2>
						</div>
						<div className="grid gap-4 p-4 md:grid-cols-2">
							<ReticleFrame className="p-4">
								<p className="font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
									Frame
								</p>
								<p className="mt-2 text-[13px] text-[var(--ret-text-dim)]">
									Hairline shell with corner cross marks.
								</p>
							</ReticleFrame>
							<ReticleCard className="p-4">
								<p className="font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
									Card
								</p>
								<Sparkline
									values={[18, 25, 22, 38, 34, 44]}
									stroke="var(--ret-accent)"
									fill
									ariaLabel="example trend"
									className="mt-4"
								/>
							</ReticleCard>
						</div>
					</DashboardPanel>
				</div>

				<DashboardPanel>
					<div className="border-b border-[var(--ret-border)] px-4 py-3">
						<ReticleLabel>Sector</ReticleLabel>
						<h2 className="mt-1 text-[15px] font-semibold">Agent primitives</h2>
					</div>
					<div className="space-y-5 p-4">
						<div className="flex flex-wrap items-center gap-x-8 gap-y-4">
							<div className="flex items-center gap-4">
								<Tell label="healthy">
									<HeartbeatDot status="healthy" size={10} />
								</Tell>
								<Tell label="degraded">
									<HeartbeatDot status="degraded" size={10} />
								</Tell>
								<Tell label="critical">
									<HeartbeatDot status="critical" size={10} />
								</Tell>
							</div>
							<div className="flex items-center gap-4">
								<Tell label="EB 82%">
									<ErrorBudgetArc remainingPct={82} status="healthy" size={34} />
								</Tell>
								<Tell label="EB 38%">
									<ErrorBudgetArc remainingPct={38} status="degraded" size={34} />
								</Tell>
								<Tell label="EB 6%">
									<ErrorBudgetArc remainingPct={6} status="critical" size={34} />
								</Tell>
							</div>
						</div>

						<div className="flex flex-wrap items-start gap-6">
							<div className="relative" style={{ width: CARD_W, height: CARD_H }}>
								<AgentCard agent={atlas} level="L2" selected />
							</div>
							<div className="relative" style={{ width: CARD_W, height: CARD_H }}>
								<AgentCard agent={pan} level="L2" />
							</div>
							<div className="relative" style={{ width: 184, height: 116 }}>
								<AgentCard agent={nyx} level="L1" />
							</div>
						</div>
						<p className="font-mono text-[10px] text-[var(--ret-text-muted)]">
							L2 full card (selected · default) and the L1 glyph tile. Color encodes one thing only: agent health.
						</p>
					</div>
				</DashboardPanel>
			</DashboardPageBody>
		</>
	);
}

function Tell({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-1.5">
			<div className="flex h-8 items-center justify-center">{children}</div>
			<span className="font-mono text-[9px] uppercase text-[var(--ret-text-muted)]">{label}</span>
		</div>
	);
}
