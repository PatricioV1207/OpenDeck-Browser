import { AppShell } from "./AppShell";
import { TabProvider } from "../features/tabs/TabProvider";
import { AppDataProvider } from "../state/AppDataProvider";

export function App() {
  return (
    <AppDataProvider>
      <TabProvider>
        <AppShell />
      </TabProvider>
    </AppDataProvider>
  );
}
