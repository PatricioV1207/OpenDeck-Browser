import type { SetActiveWorkspaceFailureCode } from "../../state/appDataActions.ts";

const SET_ACTIVE_WORKSPACE_FAILURE_MESSAGES: Record<
  SetActiveWorkspaceFailureCode,
  string
> = {
  storage:
    "The active workspace could not be changed because local app data is unavailable.",
  unsupported_schema:
    "This app data requires a newer version of OpenDeck Browser before the active workspace can be changed.",
  contract:
    "The active workspace could not be changed because the native response could not be verified.",
  internal: "The active workspace could not be changed.",
};

export function getActiveWorkspaceButtonText(isActive: boolean): string {
  return isActive ? "Already active" : "Set active";
}

export function getActiveWorkspaceButtonLabel(
  workspaceName: string,
  isActive: boolean,
): string {
  return isActive
    ? `${workspaceName} is already the active workspace`
    : `Set ${workspaceName} as the active workspace`;
}

export function getActiveWorkspaceSuccessMessage(
  outcome: "changed" | "unchanged",
): string {
  return outcome === "changed"
    ? "Active workspace updated."
    : "Workspace is already active.";
}

export function getActiveWorkspaceFailureMessage(
  code: SetActiveWorkspaceFailureCode,
): string {
  return SET_ACTIVE_WORKSPACE_FAILURE_MESSAGES[code];
}
