"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { ReticleCross } from "./ReticleCross";
import { useReticleFrameCornersDefault } from "./ReticleFrameContext";

type Props = {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	crossOffset?: number;
	corners?: boolean;
	as?: "div" | "section" | "article";
};

export function ReticleFrame({
	children,
	className,
	style,
	crossOffset = 10,
	corners,
	as: Tag = "div",
}: Props) {
	const cornersDefault = useReticleFrameCornersDefault();
	const showCorners = corners ?? cornersDefault ?? true;
	const off = `-${crossOffset}px`;
	return (
		<Tag
			className={cn(
				"relative border border-[var(--ret-border)] bg-[var(--ret-bg)]",
				className,
			)}
			style={style}
		>
			{showCorners ? (
				<>
					<ReticleCross className="absolute" style={{ top: off, left: off }} />
					<ReticleCross className="absolute" style={{ top: off, right: off }} />
					<ReticleCross className="absolute" style={{ bottom: off, left: off }} />
					<ReticleCross className="absolute" style={{ bottom: off, right: off }} />
				</>
			) : null}
			{children}
		</Tag>
	);
}
