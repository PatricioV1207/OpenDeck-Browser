import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { TAB_DEFINITIONS } from "./tabDefinitions";
import type { InternalTabId } from "./tabTypes";
import { useTabs } from "./TabProvider";

export function TabStrip() {
  const { state, activateTab, closeTab } = useTabs();
  const tabRefs = useRef(new Map<InternalTabId, HTMLButtonElement>());

  function focusTab(tabId: InternalTabId) {
    requestAnimationFrame(() => {
      tabRefs.current.get(tabId)?.focus();
    });
  }

  function activateAndFocus(tabId: InternalTabId) {
    activateTab(tabId);
    focusTab(tabId);
  }

  function closeAndFocus(tabId: InternalTabId) {
    const closingIndex = state.openTabIds.indexOf(tabId);
    const remainingTabIds = state.openTabIds.filter(
      (openTabId) => openTabId !== tabId,
    );
    const nextTabId =
      remainingTabIds[closingIndex] ??
      remainingTabIds[closingIndex - 1] ??
      "home";

    closeTab(tabId);
    focusTab(nextTabId);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: InternalTabId,
  ) {
    const currentIndex = state.openTabIds.indexOf(tabId);

    switch (event.key) {
      case "ArrowLeft": {
        event.preventDefault();
        const previousIndex =
          (currentIndex - 1 + state.openTabIds.length) %
          state.openTabIds.length;
        activateAndFocus(state.openTabIds[previousIndex]);
        break;
      }

      case "ArrowRight": {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % state.openTabIds.length;
        activateAndFocus(state.openTabIds[nextIndex]);
        break;
      }

      case "Home":
        event.preventDefault();
        activateAndFocus(state.openTabIds[0]);
        break;

      case "End":
        event.preventDefault();
        activateAndFocus(state.openTabIds[state.openTabIds.length - 1]);
        break;

      case "Delete":
        if (!TAB_DEFINITIONS[tabId].pinned) {
          event.preventDefault();
          closeAndFocus(tabId);
        }
        break;
    }
  }

  function handleCloseClick(
    event: MouseEvent<HTMLButtonElement>,
    tabId: InternalTabId,
  ) {
    event.stopPropagation();
    closeAndFocus(tabId);
  }

  return (
    <div className="tab-strip" role="tablist" aria-label="Open views">
      {state.openTabIds.map((tabId) => {
        const definition = TAB_DEFINITIONS[tabId];
        const isActive = state.activeTabId === tabId;

        return (
          <div
            className="tab-strip__item"
            data-active={isActive || undefined}
            key={tabId}
            role="presentation"
          >
            <button
              className="tab-strip__tab"
              id={`tab-${tabId}`}
              role="tab"
              type="button"
              aria-controls={`tab-panel-${tabId}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activateTab(tabId)}
              onKeyDown={(event) => handleTabKeyDown(event, tabId)}
              ref={(node) => {
                if (node === null) {
                  tabRefs.current.delete(tabId);
                } else {
                  tabRefs.current.set(tabId, node);
                }
              }}
            >
              <span className="tab-strip__tab-mark" aria-hidden="true">
                {definition.initial}
              </span>
              <span>{definition.label}</span>
            </button>

            {!definition.pinned && (
              <button
                className="tab-strip__close"
                type="button"
                aria-label={`Close ${definition.label} tab`}
                tabIndex={isActive ? 0 : -1}
                onClick={(event) => handleCloseClick(event, tabId)}
              >
                <span aria-hidden="true">x</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
