import type { ReactNode } from "react";

import { ReticleButton, ReticleFrame } from "@/components/reticle";

export function EmptyState({
	title,
	description,
	hint,
	action,
}: {
	title: string;
	description: ReactNode;
	hint?: ReactNode;
	action?: { label: string; href: string };
}) {
	return (
		<div className="mx-auto max-w-2xl px-6 py-16">
			<ReticleFrame>
				<div className="p-10 text-center">
					<div
						aria-hidden="true"
						className="mx-auto mb-7 grid h-28 w-44 place-items-center border border-[var(--ret-border)] bg-[var(--ret-bg-soft)]"
					>
						<div className="h-10 w-10 border border-[var(--ret-border-strong)]">
							<div className="h-full w-full bg-[linear-gradient(45deg,transparent_47%,var(--ret-cross)_48%,var(--ret-cross)_52%,transparent_53%)]" />
						</div>
					</div>
					<p className="font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
						Nothing here yet
					</p>
					<h2 className="mt-3 text-xl font-semibold">{title}</h2>
					<p className="mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed text-[var(--ret-text-dim)]">
						{description}
					</p>
					{hint ? (
						<pre className="mx-auto mt-5 inline-block border border-[var(--ret-border)] bg-[var(--ret-surface)] px-4 py-2 text-left font-mono text-[12px] text-[var(--ret-text-dim)]">
							{hint}
						</pre>
					) : null}
					{action ? (
						<div className="mt-6 flex justify-center">
							<ReticleButton as="a" href={action.href} variant="secondary" size="sm">
								{action.label}
							</ReticleButton>
						</div>
					) : null}
				</div>
			</ReticleFrame>
		</div>
	);
}
