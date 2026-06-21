"use client";

import { capstoneFor, credentialFor, honorsFor, numeralFor } from "@/lib/credentials";
import type { SreAgent } from "@/lib/sre-data";

// The degree conferral — the "SRE Degrees" moment. A stamped seal + diploma card,
// centered over the launch track, ink-only (a promotion is earned trust, not a
// health event), pointer-events-none, and self-dismissing with the ceremony.
// Reduced motion → a plain crossfade (no stamp/scale). aria-hidden: the tier
// change is already announced by the lens's aria-live region.
export function ConferralSeal({ agent, liveFire }: { agent: SreAgent; liveFire: boolean }) {
	const honors = honorsFor(agent, liveFire);
	return (
		<div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center" aria-hidden="true">
			<div className="ret-confer-card flex flex-col items-center gap-2 border border-[var(--ret-border-strong)] bg-[var(--ret-bg)] px-10 py-7 text-center">
				{/* conferral seal — double hairline ring + degree numeral */}
				<span className="ret-confer-seal relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ret-text)]">
					<span className="absolute inset-[3px] rounded-full border border-[var(--ret-border-strong)]" />
					<span className="font-mono text-[16px] font-semibold tracking-[0.08em] text-[var(--ret-text)]">{numeralFor(agent.autonomyTier)}</span>
				</span>
				<span className="font-mono text-[9px] uppercase tracking-[0.34em] text-[var(--ret-text-muted)]">conferred</span>
				<span className="ret-display text-[18px] tracking-[0.08em] text-[var(--ret-text)]">{credentialFor(agent.autonomyTier)}</span>
				<span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ret-text-muted)]">{capstoneFor(agent).discipline}</span>
				<span className="font-mono text-[11px] text-[var(--ret-text-dim)]">
					{agent.name} · {agent.id}
				</span>
				{honors ? <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ret-text-muted)]">— {honors} —</span> : null}
			</div>
		</div>
	);
}
