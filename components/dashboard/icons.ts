import {
	Activity,
	BarChart3,
	Command,
	FlaskConical,
	FolderKanban,
	LayoutGrid,
	Settings,
	Sparkles,
	type LucideIcon,
} from "lucide-react";

import type { IconName } from "@/lib/navigation";

export const ICONS: Record<IconName, LucideIcon> = {
	activity: Activity,
	barChart: BarChart3,
	command: Command,
	flask: FlaskConical,
	folder: FolderKanban,
	layout: LayoutGrid,
	settings: Settings,
	sparkles: Sparkles,
};
