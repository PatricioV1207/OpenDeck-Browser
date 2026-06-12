import type { TabAction, TabState } from "./tabTypes.ts";

export const initialTabState: TabState = {
  openTabIds: ["home"],
  activeTabId: "home",
};

export function tabReducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case "OPEN_TAB": {
      if (state.openTabIds.includes(action.tabId)) {
        return state.activeTabId === action.tabId
          ? state
          : { ...state, activeTabId: action.tabId };
      }

      return {
        openTabIds: [...state.openTabIds, action.tabId],
        activeTabId: action.tabId,
      };
    }

    case "ACTIVATE_TAB": {
      if (
        state.activeTabId === action.tabId ||
        !state.openTabIds.includes(action.tabId)
      ) {
        return state;
      }

      return { ...state, activeTabId: action.tabId };
    }

    case "CLOSE_TAB": {
      if (action.tabId === "home" || !state.openTabIds.includes(action.tabId)) {
        return state;
      }

      const closingIndex = state.openTabIds.indexOf(action.tabId);
      const remainingTabIds = state.openTabIds.filter(
        (tabId) => tabId !== action.tabId,
      );

      if (state.activeTabId !== action.tabId) {
        return { ...state, openTabIds: remainingTabIds };
      }

      const nextActiveTabId =
        remainingTabIds[closingIndex] ??
        remainingTabIds[closingIndex - 1] ??
        "home";

      return {
        openTabIds: remainingTabIds,
        activeTabId: nextActiveTabId,
      };
    }
  }
}
