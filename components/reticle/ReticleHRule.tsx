import { cn } from "@/lib/cn";

export function ReticleHRule({ className }: { className?: string }) {
	return <div className={cn("h-px w-full bg-[var(--ret-border)]", className)} />;
}
