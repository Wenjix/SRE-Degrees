import type { CommandEntity, StatusTone } from "@/lib/navigation";

export type ProjectStatus = "running" | "queued" | "blocked" | "idle";

export type DemoProject = {
	id: string;
	name: string;
	owner: string;
	status: ProjectStatus;
	tone: StatusTone;
	updated: string;
	runs: number;
	successRate: number;
	latencyMs: number;
	budget: string;
	description: string;
};

export const projects: DemoProject[] = [
	{
		id: "prj_control",
		name: "Control Plane",
		owner: "Platform",
		status: "running",
		tone: "ok",
		updated: "4 min ago",
		runs: 128,
		successRate: 98,
		latencyMs: 184,
		budget: "$420",
		description: "Core app orchestration, event streams, and operator surfaces.",
	},
	{
		id: "prj_ingest",
		name: "Ingest Workers",
		owner: "Data",
		status: "queued",
		tone: "warn",
		updated: "18 min ago",
		runs: 64,
		successRate: 93,
		latencyMs: 260,
		budget: "$190",
		description: "Batch connectors, sync jobs, and normalization pipeline.",
	},
	{
		id: "prj_review",
		name: "Review Console",
		owner: "Ops",
		status: "blocked",
		tone: "error",
		updated: "41 min ago",
		runs: 22,
		successRate: 84,
		latencyMs: 412,
		budget: "$85",
		description: "Human review queue with artifact trace and approval history.",
	},
	{
		id: "prj_sandbox",
		name: "Sandbox Lab",
		owner: "Research",
		status: "idle",
		tone: "neutral",
		updated: "2 hr ago",
		runs: 11,
		successRate: 100,
		latencyMs: 96,
		budget: "$40",
		description: "Prototype workflows and isolated validation runs.",
	},
];

export const commandEntities: CommandEntity[] = projects.map((project) => ({
	id: project.id,
	name: project.name,
	status: project.status,
	href: "/dashboard/projects",
	keywords: `${project.owner} ${project.description}`,
}));

export const overviewMetrics = [
	{ label: "Active projects", value: "4", tone: "default" as const, hint: "+1 this week" },
	{ label: "Runs today", value: "225", tone: "ok" as const, hint: "98% complete" },
	{ label: "Queue depth", value: "7", tone: "warn" as const, hint: "2 delayed" },
	{ label: "Incident load", value: "1", tone: "error" as const, hint: "review needed" },
];

export const runSeries = [
	{ date: "2026-06-14", runs: 31 },
	{ date: "2026-06-15", runs: 42 },
	{ date: "2026-06-16", runs: 38 },
	{ date: "2026-06-17", runs: 51 },
	{ date: "2026-06-18", runs: 47 },
	{ date: "2026-06-19", runs: 58 },
	{ date: "2026-06-20", runs: 44 },
];

export const activityFeed = [
	{ ts: "09:42", level: "info", message: "Control Plane published deployment manifest." },
	{ ts: "09:36", level: "warn", message: "Ingest Workers queue exceeded target depth." },
	{ ts: "09:18", level: "ok", message: "Sandbox Lab completed validation run." },
	{ ts: "08:54", level: "error", message: "Review Console approval step needs owner action." },
];

export const settingsRows = [
	{ key: "Theme", value: "System", note: "Stored in localStorage only." },
	{ key: "Density", value: "Compact", note: "Optimized for repeated operational use." },
	{ key: "Auth", value: "Disabled", note: "Starter intentionally ships without auth." },
	{ key: "Data source", value: "Local demo", note: "Replace lib/demo-data.ts with your adapter." },
];
