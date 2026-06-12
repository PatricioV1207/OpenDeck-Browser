import {
  INTERNAL_TAB_IDS,
  TAB_DEFINITIONS,
} from "../../features/tabs/tabDefinitions";
import { useTabs } from "../../features/tabs/TabProvider";

export function Sidebar() {
  const { state, openTab } = useTabs();

  return (
    <aside className="sidebar" aria-label="OpenDeck Browser sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">
          OD
        </span>
        <span className="sidebar__brand-name">OpenDeck Browser</span>
      </div>

      <section
        className="sidebar__navigation"
        aria-labelledby="internal-views-title"
      >
        <p className="sidebar__section-label" id="internal-views-title">
          Internal views
        </p>
        <ul className="sidebar__items">
          {INTERNAL_TAB_IDS.map((tabId) => (
            <li className="sidebar__item" key={tabId}>
              <button
                className="sidebar__item-button"
                type="button"
                aria-current={
                  state.activeTabId === tabId ? "page" : undefined
                }
                onClick={() => openTab(tabId)}
              >
                <span className="sidebar__item-mark" aria-hidden="true">
                  {TAB_DEFINITIONS[tabId].initial}
                </span>
                <span className="sidebar__item-label">
                  {TAB_DEFINITIONS[tabId].label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="sidebar__note">Open tabs reset when the app restarts.</p>
    </aside>
  );
}
