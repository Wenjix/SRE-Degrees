"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { agentCommandEntities as commandEntities } from "@/lib/sre-data";
import {
	buildCommands,
	filterCommands,
	type Command,
	type CommandGroup,
} from "@/lib/navigation";
import { cn } from "@/lib/cn";

const GROUP_LABEL: Record<CommandGroup, string> = {
	navigate: "Navigate",
	entities: "Agents",
	actions: "Actions",
};

export function CommandPalette() {
	const router = useRouter();
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedRef = useRef<HTMLButtonElement>(null);
	const commands = useMemo(
		() => buildCommands({ entities: commandEntities }),
		[],
	);
	const visible = useMemo(
		() => filterCommands(commands, query),
		[commands, query],
	);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelected(0);
		const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
		return () => window.clearTimeout(focusTimer);
	}, [open]);

	useEffect(() => {
		setSelected((prev) => (prev >= visible.length ? 0 : prev));
	}, [visible.length]);

	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "nearest" });
	}, [selected]);

	const close = useCallback(() => setOpen(false), []);

	const activate = useCallback(
		(command: Command | undefined) => {
			if (!command) return;
			setOpen(false);
			router.push(command.href);
		},
		[router],
	);

	const onInputKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelected((i) => (visible.length ? (i + 1) % visible.length : 0));
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelected((i) =>
					visible.length ? (i - 1 + visible.length) % visible.length : 0,
				);
			} else if (event.key === "Enter") {
				event.preventDefault();
				activate(visible[selected]);
			} else if (event.key === "Escape") {
				event.preventDefault();
				close();
			}
		},
		[visible, selected, activate, close],
	);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex h-8 items-center gap-2 border border-[var(--ret-border)] bg-[var(--ret-bg-soft)] px-2.5 text-[12px] text-[var(--ret-text-muted)] transition-colors hover:border-[var(--ret-border-hover)] hover:text-[var(--ret-text)]"
			>
				<Search className="h-3.5 w-3.5" strokeWidth={1.75} />
				<span>Search</span>
				<span className="border border-[var(--ret-border)] px-1 font-mono text-[10px]">
					Cmd K
				</span>
			</button>
			{mounted && open
				? createPortal(
						<div
							className="fixed inset-0 z-[80] bg-black/40 px-4 py-[12vh] backdrop-blur-sm"
							onMouseDown={close}
						>
							<div
								role="dialog"
								aria-modal="true"
								aria-label="Command palette"
								className="mx-auto max-w-xl border border-[var(--ret-border)] bg-[var(--ret-bg)]"
								onMouseDown={(event) => event.stopPropagation()}
							>
								<div className="flex items-center gap-2 border-b border-[var(--ret-border)] px-3 py-2">
									<Search
										className="h-4 w-4 text-[var(--ret-text-muted)]"
										strokeWidth={1.75}
									/>
									<input
										ref={inputRef}
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										onKeyDown={onInputKeyDown}
										placeholder="Jump to a route or agent"
										className="h-8 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--ret-text-muted)]"
									/>
								</div>
								<div className="max-h-[420px] overflow-y-auto py-2">
									{visible.length ? (
										<CommandList
											commands={visible}
											selected={selected}
											selectedRef={selectedRef}
											onPick={activate}
										/>
									) : (
										<p className="px-4 py-10 text-center text-[13px] text-[var(--ret-text-muted)]">
											No commands found.
										</p>
									)}
								</div>
								<div className="flex items-center justify-between border-t border-[var(--ret-border)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ret-text-muted)]">
									<span>↑↓ move · ↵ open · esc close</span>
									<span>⌘K</span>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}

function CommandList({
	commands,
	selected,
	selectedRef,
	onPick,
}: {
	commands: Command[];
	selected: number;
	selectedRef: React.RefObject<HTMLButtonElement | null>;
	onPick: (command: Command) => void;
}) {
	let lastGroup: CommandGroup | null = null;
	let index = -1;
	return (
		<div>
			{commands.map((command) => {
				index += 1;
				const showGroup = command.group !== lastGroup;
				lastGroup = command.group;
				const active = index === selected;
				return (
					<div key={command.id}>
						{showGroup ? (
							<p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase text-[var(--ret-text-muted)]">
								{GROUP_LABEL[command.group]}
							</p>
						) : null}
						<button
							ref={active ? selectedRef : undefined}
							type="button"
							onMouseEnter={() => undefined}
							onClick={() => onPick(command)}
							className={cn(
								"flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
								active
									? "bg-[var(--ret-accent-glow)] text-[var(--ret-accent)]"
									: "text-[var(--ret-text)] hover:bg-[var(--ret-surface)]",
							)}
						>
							<span className="min-w-0">
								<span className="block truncate text-[13px] font-medium">
									{command.label}
								</span>
								{command.hint ? (
									<span className="block truncate font-mono text-[10px] text-[var(--ret-text-muted)]">
										{command.hint}
									</span>
								) : null}
							</span>
							<span className="shrink-0 font-mono text-[10px] text-[var(--ret-text-muted)]">
								{command.href}
							</span>
						</button>
					</div>
				);
			})}
		</div>
	);
}
