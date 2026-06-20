"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { BRAND } from "@/lib/navigation";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

const THEMES = [
	{ id: "light", label: "Light", Icon: Sun },
	{ id: "dark", label: "Dark", Icon: Moon },
	{ id: "system", label: "System", Icon: Monitor },
] as const;

function readStored(): Theme {
	if (typeof window === "undefined") return "system";
	const value = window.localStorage.getItem(BRAND.themeStorageKey);
	if (value === "light" || value === "dark" || value === "system") return value;
	return "system";
}

function systemPrefersDark(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	const isDark =
		theme === "dark" || (theme === "system" && systemPrefersDark());
	root.classList.toggle("dark", isDark);
	if (theme === "system") {
		root.removeAttribute("data-theme");
	} else {
		root.setAttribute("data-theme", theme);
	}
}

export function ThemeToggle({ className }: { className?: string }) {
	const [theme, setTheme] = useState<Theme>("system");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const stored = readStored();
		setTheme(stored);
		applyTheme(stored);
	}, []);

	useEffect(() => {
		if (theme !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [theme]);

	function pick(next: Theme) {
		setTheme(next);
		applyTheme(next);
		try {
			window.localStorage.setItem(BRAND.themeStorageKey, next);
		} catch {
			// Storage can be disabled in private contexts.
		}
	}

	const active = mounted ? theme : "system";

	return (
		<div
			role="radiogroup"
			aria-label="Theme"
			className={cn(
				"flex h-8 overflow-hidden border border-[var(--ret-border)] bg-[var(--ret-bg-soft)]",
				className,
			)}
		>
			{THEMES.map(({ id, label, Icon }) => {
				const isActive = active === id;
				return (
					<button
						key={id}
						type="button"
						role="radio"
						aria-checked={isActive}
						onClick={() => pick(id)}
						className={cn(
							"flex h-full w-8 items-center justify-center transition-colors",
							isActive
								? "bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]"
								: "text-[var(--ret-text-muted)] hover:text-[var(--ret-text)]",
						)}
						title={`${label} theme`}
					>
						<Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
						<span className="sr-only">{label}</span>
					</button>
				);
			})}
		</div>
	);
}
