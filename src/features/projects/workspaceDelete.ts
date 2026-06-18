import type { DeleteWorkspaceFailureCode } from "../../state/appDataActions";

const DELETE_WORKSPACE_FAILURE_MESSAGES: Record<
  DeleteWorkspaceFailureCode,
  string
> = {
  storage:
    "The workspace could not be deleted because local app data is unavailable.",
  unsupported_schema:
    "This app data requires a newer version of OpenDeck Browser before a workspace can be deleted.",
  contract:
    "The workspace could not be deleted because the native response could not be verified.",
  internal: "The workspace could not be deleted.",
};

export const DELETE_WORKSPACE_SUCCESS_MESSAGE = "Workspace deleted.";

export const DELETE_WORKSPACE_CONFIRMATION_COPY =
  "This removes only local workspace metadata. It does not delete repositories, folders, files, credentials, or remote data.";

export function getDeleteWorkspaceButtonLabel(
  workspaceName: string,
): string {
  return `Delete ${workspaceName}`;
}

export function getConfirmDeleteWorkspaceButtonLabel(
  workspaceName: string,
): string {
  return `Delete workspace ${workspaceName}`;
}

export function getCancelDeleteWorkspaceButtonLabel(
  workspaceName: string,
): string {
  return `Cancel deleting ${workspaceName}`;
}

export function getDeleteWorkspaceFailureMessage(
  code: DeleteWorkspaceFailureCode,
): string {
  return DELETE_WORKSPACE_FAILURE_MESSAGES[code];
}
