import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { BRAND } from "@/lib/navigation";

import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: `${BRAND.name} | Operational dashboard starter`,
		template: `%s | ${BRAND.name}`,
	},
	description:
		"A promotion console where SRE agents earn autonomy through verified incident evidence.",
	applicationName: BRAND.name,
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fbfbfb" },
		{ media: "(prefers-color-scheme: dark)", color: "#09090b" },
	],
	colorScheme: "light dark",
	width: "device-width",
	initialScale: 1,
};

const THEME_BOOT = `(function(){try{var s=localStorage.getItem("${BRAND.themeStorageKey}");var t=(s==="light"||s==="dark"||s==="system")?s:"system";var sys=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=t==="dark"||(t==="system"&&sys);var r=document.documentElement;if(dark){r.classList.add("dark");}else{r.classList.remove("dark");}if(t==="system"){r.removeAttribute("data-theme");}else{r.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<Script id="theme-boot" strategy="beforeInteractive">
					{THEME_BOOT}
				</Script>
				{children}
				<div className="ret-grain" aria-hidden="true" />
			</body>
		</html>
	);
}
