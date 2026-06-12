import type { InternalTabId, TabDefinition } from "./tabTypes.ts";

export const TAB_DEFINITIONS: Record<InternalTabId, TabDefinition> = {
  home: {
    id: "home",
    label: "Home",
    initial: "H",
    pinned: true,
  },
  projects: {
    id: "projects",
    label: "Projects",
    initial: "P",
    pinned: false,
  },
  settings: {
    id: "settings",
    label: "Settings",
    initial: "S",
    pinned: false,
  },
  about: {
    id: "about",
    label: "About",
    initial: "A",
    pinned: false,
  },
};

export const INTERNAL_TAB_IDS = Object.keys(
  TAB_DEFINITIONS,
) as InternalTabId[];
