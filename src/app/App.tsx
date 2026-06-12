import { AppShell } from "./AppShell";
import { TabProvider } from "../features/tabs/TabProvider";

export function App() {
  return (
    <TabProvider>
      <AppShell />
    </TabProvider>
  );
}
