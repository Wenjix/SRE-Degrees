"use client";

import {
	createContext,
	useContext,
	type ReactNode,
} from "react";

const ReticleFrameCornersContext = createContext<boolean | undefined>(undefined);

export function useReticleFrameCornersDefault() {
	return useContext(ReticleFrameCornersContext);
}

export function ReticleFrameProvider({
	children,
	corners,
}: {
	children: ReactNode;
	corners?: boolean;
}) {
	return (
		<ReticleFrameCornersContext.Provider value={corners}>
			{children}
		</ReticleFrameCornersContext.Provider>
	);
}
