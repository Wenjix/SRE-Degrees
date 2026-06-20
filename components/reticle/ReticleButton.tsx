"use client";

import type {
	AnchorHTMLAttributes,
	ButtonHTMLAttributes,
	ReactNode,
} from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
	primary:
		"bg-[var(--ret-accent)] text-[var(--ret-bg)] hover:brightness-110",
	secondary:
		"border border-[var(--ret-border-hover)] text-[var(--ret-text)] hover:bg-[var(--ret-surface)]",
	ghost:
		"text-[var(--ret-text-secondary)] hover:bg-[var(--ret-surface)] hover:text-[var(--ret-text)]",
};

const SIZE: Record<Size, string> = {
	sm: "gap-1.5 px-3 py-1.5 text-[12px]",
	md: "gap-2 px-5 py-2.5 text-[13px]",
	lg: "gap-2 px-7 py-3 text-[14px]",
};

const BASE =
	"inline-flex cursor-pointer select-none items-center justify-center font-medium transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0";

type SharedProps = {
	variant?: Variant;
	size?: Size;
	children?: ReactNode;
};

type ButtonProps = SharedProps &
	ButtonHTMLAttributes<HTMLButtonElement> & {
		as?: "button";
		href?: never;
	};

type AnchorProps = SharedProps &
	AnchorHTMLAttributes<HTMLAnchorElement> & {
		as: "a";
		href: string;
	};

export type ReticleButtonProps = ButtonProps | AnchorProps;

export const ReticleButton = forwardRef<
	HTMLButtonElement | HTMLAnchorElement,
	ReticleButtonProps
>(function ReticleButton(props, ref) {
	const { variant = "primary", size = "md", className, as, ...rest } = props;
	const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

	if (as === "a") {
		const { href, ...anchorRest } = rest as AnchorProps;
		return (
			<a
				ref={ref as React.Ref<HTMLAnchorElement>}
				href={href}
				className={classes}
				{...anchorRest}
			/>
		);
	}

	return (
		<button
			ref={ref as React.Ref<HTMLButtonElement>}
			className={classes}
			{...(rest as ButtonProps)}
		/>
	);
});
