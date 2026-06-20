import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(
	new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
const warningFlag = "--disable-warning=DEP0205";
const nodeOptions = existingNodeOptions.includes(warningFlag)
	? existingNodeOptions
	: `${existingNodeOptions} ${warningFlag}`.trim();

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
	stdio: "inherit",
	env: {
		...process.env,
		NODE_OPTIONS: nodeOptions,
	},
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 0);
});

child.on("error", (error) => {
	console.error(error);
	process.exit(1);
});
