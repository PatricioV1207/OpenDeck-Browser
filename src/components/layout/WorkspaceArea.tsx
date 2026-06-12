import { ActiveTabPanel } from "../../features/tabs/ActiveTabPanel";
import { TabStrip } from "../../features/tabs/TabStrip";

export function WorkspaceArea() {
  return (
    <main className="workspace">
      <TabStrip />
      <ActiveTabPanel />
    </main>
  );
}
