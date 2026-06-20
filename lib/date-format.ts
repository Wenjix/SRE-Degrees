const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

export function formatDayShort(value: string): string {
	const [, month, day] = value.split("-").map((part) => Number(part));
	const monthLabel = MONTH_LABELS[(month || 1) - 1] ?? MONTH_LABELS[0];
	return `${monthLabel} ${day || 1}`;
}
