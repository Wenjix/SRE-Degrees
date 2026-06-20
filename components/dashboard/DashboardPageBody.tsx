import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function DashboardPageBody({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cn("space-y-4 px-5 py-4", className)}>{children}</div>;
}
