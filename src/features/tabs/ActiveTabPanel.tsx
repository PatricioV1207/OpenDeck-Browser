import { TAB_DEFINITIONS } from "./tabDefinitions";
import { useTabs } from "./TabProvider";

export function ActiveTabPanel() {
  const { state } = useTabs();

  return (
    <>
      {state.openTabIds.map((tabId) => {
        const tab = TAB_DEFINITIONS[tabId];
        const isActive = state.activeTabId === tabId;

        return (
          <section
            className="workspace__content"
            id={`tab-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
            key={tab.id}
          >
            <p className="workspace__eyebrow">Internal view placeholder</p>
            <h1>{tab.label}</h1>
            <p className="workspace__summary">{tab.placeholder}</p>

            <div className="workspace__readiness" aria-label="Tab status">
              <div>
                <span>Tab behavior</span>
                <strong>Frontend only</strong>
              </div>
              <div>
                <span>Session state</span>
                <strong>Resets on restart</strong>
              </div>
              <div>
                <span>Feature content</span>
                <strong>Not implemented</strong>
              </div>
            </div>

            <p className="workspace__note">
              This tab contains no persistence, native commands, remote
              content, or feature-specific behavior.
            </p>
          </section>
        );
      })}
    </>
  );
}
