"use client";

import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/cn";

import { useLens } from "./LensProvider";
import { useAmbientSound } from "./useAmbientSound";

// The mute toggle. Its click is the user gesture that constructs/resumes the
// AudioContext (autoplay-safe). Hosting the audio engine here keeps it tied to
// the control. Sound is an enhancement — status is always conveyed visually too.
export function SoundToggle({ className }: { className?: string }) {
	const { state, toggleSound } = useLens();
	useAmbientSound();
	const on = state.soundOn;
	return (
		<button
			type="button"
			onClick={toggleSound}
			aria-pressed={on}
			aria-label={on ? "Mute sonifier" : "Enable sonifier"}
			title={on ? "Sonifier on — alerts are panned by zone" : "Sonifier off — click to enable audio"}
			className={cn(
				"flex h-8 items-center gap-1.5 border px-2 font-mono text-[11px] transition-colors",
				on
					? "border-[var(--ret-accent)] text-[var(--ret-text)]"
					: "border-[var(--ret-border)] text-[var(--ret-text-muted)] hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]",
				className,
			)}
		>
			{on ? <Volume2 className="h-3.5 w-3.5" strokeWidth={1.75} /> : <VolumeX className="h-3.5 w-3.5" strokeWidth={1.75} />}
			<span className="hidden sm:inline">{on ? "SOUND" : "MUTED"}</span>
		</button>
	);
}
