import type { ReactNode } from "react";

import { ReticleLabel } from "@/components/reticle";

export function PageHeader({
	kicker,
	title,
	description,
	right,
}: {
	kicker: string;
	title: string;
	description?: ReactNode;
	right?: ReactNode;
}) {
	return (
		<header className="relative overflow-hidden border-b border-[var(--ret-border)]">
			<div className="relative z-10 flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5">
				<div className="min-w-0 flex-1">
					<ReticleLabel>{kicker}</ReticleLabel>
					<h1 className="ret-display mt-1.5 text-lg md:text-xl">{title}</h1>
					{description ? (
						<p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-[var(--ret-text-dim)]">
							{description}
						</p>
					) : null}
				</div>
				{right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
			</div>
		</header>
	);
}
