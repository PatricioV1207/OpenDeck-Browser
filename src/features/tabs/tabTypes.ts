export type InternalTabId = "home" | "projects" | "settings" | "about";

export interface TabDefinition {
  id: InternalTabId;
  label: string;
  initial: string;
  pinned: boolean;
  placeholder: string;
}

export interface TabState {
  openTabIds: InternalTabId[];
  activeTabId: InternalTabId;
}

export type TabAction =
  | { type: "OPEN_TAB"; tabId: InternalTabId }
  | { type: "ACTIVATE_TAB"; tabId: InternalTabId }
  | { type: "CLOSE_TAB"; tabId: InternalTabId };
