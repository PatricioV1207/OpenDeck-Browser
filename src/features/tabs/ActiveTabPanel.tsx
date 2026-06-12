import type { ComponentType } from "react";
import { AboutView } from "../about/AboutView";
import { HomeView } from "../home/HomeView";
import { ProjectsView } from "../projects/ProjectsView";
import { SettingsView } from "../settings/SettingsView";
import type { InternalTabId } from "./tabTypes";
import { useTabs } from "./TabProvider";

const VIEW_COMPONENTS: Record<InternalTabId, ComponentType> = {
  home: HomeView,
  projects: ProjectsView,
  settings: SettingsView,
  about: AboutView,
};

export function ActiveTabPanel() {
  const { state } = useTabs();

  return (
    <>
      {state.openTabIds.map((tabId) => {
        const ViewComponent = VIEW_COMPONENTS[tabId];
        const isActive = state.activeTabId === tabId;

        return (
          <section
            className="workspace__content"
            id={`tab-panel-${tabId}`}
            role="tabpanel"
            aria-labelledby={`tab-${tabId}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
            key={tabId}
          >
            <ViewComponent />
          </section>
        );
      })}
    </>
  );
}
