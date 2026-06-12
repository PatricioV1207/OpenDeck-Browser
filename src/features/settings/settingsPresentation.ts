import type {
  AppDataLoadFailureCode,
  AppDataState,
} from "../../state/appDataState.ts";
import type { AppSettingsDto, ColorMode } from "../../types/appData.ts";

export interface SettingPresentationRow {
  readonly id: "color-mode" | "sidebar-presentation" | "status-panel";
  readonly name: string;
  readonly description: string;
  readonly value: string;
}

export type SettingsPresentation =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "error";
      readonly message: string;
    }
  | {
      readonly status: "ready";
      readonly rows: readonly SettingPresentationRow[];
    };

const SETTINGS_ERROR_MESSAGES: Record<AppDataLoadFailureCode, string> = {
  unsupported_schema:
    "Settings cannot be shown because this app data requires a newer version of OpenDeck Browser.",
  storage:
    "Settings are unavailable because local app data could not be loaded safely.",
  contract:
    "Settings are unavailable because the native app data response could not be verified.",
  internal: "Settings are unavailable because local app data could not be loaded.",
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function createSettingsPresentation(
  state: AppDataState,
): SettingsPresentation {
  if (state.status === "loading") {
    return { status: "loading" };
  }

  if (state.status === "error") {
    return {
      status: "error",
      message: SETTINGS_ERROR_MESSAGES[state.error.code],
    };
  }

  return {
    status: "ready",
    rows: createSettingRows(state.data.settings),
  };
}

function createSettingRows(
  settings: AppSettingsDto,
): readonly SettingPresentationRow[] {
  return [
    {
      id: "color-mode",
      name: "Color mode",
      description:
        "Stored appearance preference. The interface does not apply this value yet.",
      value: COLOR_MODE_LABELS[settings.colorMode],
    },
    {
      id: "sidebar-presentation",
      name: "Sidebar presentation",
      description:
        "Stored sidebar preference. Responsive layout behavior remains unchanged.",
      value: settings.sidebarCollapsed ? "Collapsed" : "Expanded",
    },
    {
      id: "status-panel",
      name: "Status panel",
      description:
        "Stored visibility preference. The status panel remains visible in this step.",
      value: settings.statusPanelVisible ? "Visible" : "Hidden",
    },
  ];
}
