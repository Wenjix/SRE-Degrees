"use client";

import {
	createContext,
	useContext,
	type CSSProperties,
	type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

import { RETICLE_SIZES } from "./constants";

const PageGridContext = createContext(false);

export function useIsInsidePageGrid(): boolean {
	return useContext(PageGridContext);
}

const MARGIN_HATCH =
	"repeating-linear-gradient(45deg, var(--ret-rail) 0 1px, transparent 1px 6px)";

export function ReticlePageGrid({
	children,
	className,
	contentMax = RETICLE_SIZES.contentMax,
}: {
	children: ReactNode;
	className?: string;
	contentMax?: number;
}) {
	const style = {
		"--ret-content-max": `${contentMax}px`,
	} as CSSProperties;
	return (
		<PageGridContext.Provider value={true}>
			<div
				className={cn("relative min-h-[100dvh] bg-[var(--ret-bg)]", className)}
				style={{ ...style, overflowX: "clip" }}
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 top-0 z-[2] hidden w-[var(--ret-rail-offset)] border-x border-[var(--ret-border)] lg:block"
					style={{
						left: "calc(50% - var(--ret-content-max) / 2 - var(--ret-rail-offset))",
						backgroundImage: MARGIN_HATCH,
					}}
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-0 top-0 z-[2] hidden w-[var(--ret-rail-offset)] border-x border-[var(--ret-border)] lg:block"
					style={{
						left: "calc(50% + var(--ret-content-max) / 2)",
						backgroundImage: MARGIN_HATCH,
					}}
				/>
				<div className="relative z-[1] flex flex-col">{children}</div>
			</div>
		</PageGridContext.Provider>
	);
}
