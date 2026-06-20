import { LensProvider } from "@/components/sector/LensProvider";
import { SectorWorkspace } from "@/components/sector/SectorWorkspace";

export default function DashboardPage() {
	return (
		<LensProvider>
			<SectorWorkspace />
		</LensProvider>
	);
}
