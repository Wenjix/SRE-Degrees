import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildCommands,
	filterCommands,
	isNavActive,
	NAV_SECTIONS,
	STATUS_TONE_CLASS,
} from "../lib/navigation.ts";
import { formatDayShort } from "../lib/date-format.ts";

describe("navigation helpers", () => {
	it("matches exact dashboard root without lighting child routes", () => {
		const overview = NAV_SECTIONS[0].items[0];
		assert.equal(isNavActive("/dashboard", overview), true);
		assert.equal(isNavActive("/dashboard/projects", overview), false);
	});

	it("matches nested non-exact routes", () => {
		const projects = NAV_SECTIONS[0].items[1];
		assert.equal(isNavActive("/dashboard/projects", projects), true);
		assert.equal(isNavActive("/dashboard/projects/alpha", projects), true);
	});

	it("filters commands by label and aux keywords", () => {
		const commands = buildCommands({
			entities: [
				{
					id: "alpha",
					name: "Alpha Queue",
					status: "running",
					href: "/dashboard/projects",
					keywords: "payments nightly",
				},
			],
		});

		assert.equal(filterCommands(commands, "alpha")[0].label, "Alpha Queue");
		assert.equal(filterCommands(commands, "payments")[0].label, "Alpha Queue");
		assert.equal(filterCommands(commands, "settings")[0].label, "Settings");
	});

	it("keeps status tone classes explicit", () => {
		assert.match(STATUS_TONE_CLASS.ok, /--ret-green/);
		assert.match(STATUS_TONE_CLASS.warn, /--ret-amber/);
		assert.match(STATUS_TONE_CLASS.error, /--ret-red/);
	});

	it("formats chart dates without locale or timezone drift", () => {
		assert.equal(formatDayShort("2026-06-14"), "Jun 14");
		assert.equal(formatDayShort("2026-12-01"), "Dec 1");
	});
});
