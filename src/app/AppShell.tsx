import { Sidebar } from "../components/layout/Sidebar";
import { StatusPanel } from "../components/layout/StatusPanel";
import { TopBar } from "../components/layout/TopBar";
import { WorkspaceArea } from "../components/layout/WorkspaceArea";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <TopBar />
      <WorkspaceArea />
      <StatusPanel />
    </div>
  );
}
