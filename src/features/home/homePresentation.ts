import type {
  AppDataLoadFailureCode,
  AppDataState,
} from "../../state/appDataState.ts";
import type { ColorMode } from "../../types/appData.ts";

export interface HomeSummary {
  readonly workspaceCount: string;
  readonly activeWorkspaceName: string;
  readonly colorMode: string;
  readonly appDataStatus: "Loaded and validated";
}

export type HomePresentation =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "error";
      readonly message: string;
    }
  | {
      readonly status: "ready";
      readonly summary: HomeSummary;
    };

const HOME_ERROR_MESSAGES: Record<AppDataLoadFailureCode, string> = {
  unsupported_schema:
    "Home cannot show an app-data summary because this data requires a newer version of OpenDeck Browser.",
  storage:
    "The app-data summary is unavailable because local app data could not be loaded safely.",
  contract:
    "The app-data summary is unavailable because the native response could not be verified.",
  internal:
    "The app-data summary is unavailable because local app data could not be loaded.",
};

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function createHomePresentation(
  state: AppDataState,
): HomePresentation {
  if (state.status === "loading") {
    return { status: "loading" };
  }

  if (state.status === "error") {
    return {
      status: "error",
      message: HOME_ERROR_MESSAGES[state.error.code],
    };
  }

  const workspaceCount = state.data.workspaces.length;
  const activeWorkspace = state.data.workspaces.find(
    (workspace) => workspace.id === state.data.activeWorkspaceId,
  );

  return {
    status: "ready",
    summary: {
      workspaceCount: `${workspaceCount} ${
        workspaceCount === 1 ? "workspace" : "workspaces"
      }`,
      activeWorkspaceName: activeWorkspace?.name ?? "No active workspace",
      colorMode: COLOR_MODE_LABELS[state.data.settings.colorMode],
      appDataStatus: "Loaded and validated",
    },
  };
}
