import type {
  AppSettingsDto,
  AppSettingsPatch,
} from "../../types/appData.ts";
import type {
  UpdateSettingsFailureCode,
  UpdateSettingsResult,
} from "../../state/appDataActions.ts";

export interface SettingsDraft {
  readonly colorMode: AppSettingsDto["colorMode"];
  readonly sidebarCollapsed: boolean;
  readonly statusPanelVisible: boolean;
}

const UPDATE_FAILURE_MESSAGES: Record<UpdateSettingsFailureCode, string> = {
  validation: "Settings were not saved because the selected values are invalid.",
  storage: "Settings could not be saved safely.",
  unsupported_schema:
    "Settings cannot be saved because this app data requires a newer version of OpenDeck Browser.",
  contract:
    "Settings were not saved because the native response could not be verified.",
  internal: "Settings could not be saved.",
};

const UPDATE_SUCCESS_MESSAGES: Record<
  Extract<UpdateSettingsResult, { ok: true }>["outcome"],
  string
> = {
  updated: "Settings saved. Interface application remains deferred.",
  unchanged:
    "Settings are already up to date. Interface application remains deferred.",
};

export function createSettingsDraft(
  settings: AppSettingsDto,
): SettingsDraft {
  return {
    colorMode: settings.colorMode,
    sidebarCollapsed: settings.sidebarCollapsed,
    statusPanelVisible: settings.statusPanelVisible,
  };
}

export function createSettingsPatch(
  settings: AppSettingsDto,
  draft: SettingsDraft,
): AppSettingsPatch | null {
  const patch: {
    colorMode?: AppSettingsDto["colorMode"];
    sidebarCollapsed?: boolean;
    statusPanelVisible?: boolean;
  } = {};

  if (draft.colorMode !== settings.colorMode) {
    patch.colorMode = draft.colorMode;
  }
  if (draft.sidebarCollapsed !== settings.sidebarCollapsed) {
    patch.sidebarCollapsed = draft.sidebarCollapsed;
  }
  if (draft.statusPanelVisible !== settings.statusPanelVisible) {
    patch.statusPanelVisible = draft.statusPanelVisible;
  }

  return Object.keys(patch).length === 0 ? null : patch;
}

export function getUpdateSettingsFailureMessage(
  code: UpdateSettingsFailureCode,
): string {
  return UPDATE_FAILURE_MESSAGES[code];
}

export function getUpdateSettingsSuccessMessage(
  outcome: Extract<UpdateSettingsResult, { ok: true }>["outcome"],
): string {
  return UPDATE_SUCCESS_MESSAGES[outcome];
}
