import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { initialTabState, tabReducer } from "./tabReducer";
import type { InternalTabId, TabState } from "./tabTypes";

interface TabContextValue {
  state: TabState;
  openTab: (tabId: InternalTabId) => void;
  activateTab: (tabId: InternalTabId) => void;
  closeTab: (tabId: InternalTabId) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function TabProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tabReducer, initialTabState);

  const openTab = useCallback((tabId: InternalTabId) => {
    dispatch({ type: "OPEN_TAB", tabId });
  }, []);

  const activateTab = useCallback((tabId: InternalTabId) => {
    dispatch({ type: "ACTIVATE_TAB", tabId });
  }, []);

  const closeTab = useCallback((tabId: InternalTabId) => {
    dispatch({ type: "CLOSE_TAB", tabId });
  }, []);

  const value = useMemo(
    () => ({ state, openTab, activateTab, closeTab }),
    [activateTab, closeTab, openTab, state],
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabs() {
  const context = useContext(TabContext);

  if (context === null) {
    throw new Error("useTabs must be used within a TabProvider.");
  }

  return context;
}
