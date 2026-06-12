import type { InternalTabId, TabDefinition } from "./tabTypes.ts";

export const TAB_DEFINITIONS: Record<InternalTabId, TabDefinition> = {
  home: {
    id: "home",
    label: "Home",
    initial: "H",
    pinned: true,
    placeholder: "The Home view is not implemented yet.",
  },
  projects: {
    id: "projects",
    label: "Projects",
    initial: "P",
    pinned: false,
    placeholder: "The Projects view is not implemented yet.",
  },
  settings: {
    id: "settings",
    label: "Settings",
    initial: "S",
    pinned: false,
    placeholder: "The Settings view is not implemented yet.",
  },
  about: {
    id: "about",
    label: "About",
    initial: "A",
    pinned: false,
    placeholder: "The About view is not implemented yet.",
  },
};

export const INTERNAL_TAB_IDS = Object.keys(
  TAB_DEFINITIONS,
) as InternalTabId[];
