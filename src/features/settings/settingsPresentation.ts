import type {
  AppDataLoadFailureCode,
  AppDataState,
} from "../../state/appDataState.ts";
import type { AppSettingsDto } from "../../types/appData.ts";

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
      readonly settings: AppSettingsDto;
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
    settings: { ...state.data.settings },
  };
}
