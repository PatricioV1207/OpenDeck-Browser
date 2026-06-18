import type { RenameWorkspaceFailureCode } from "../../state/appDataActions.ts";
import type { WorkspaceDto } from "../../types/appData.ts";

const MAX_WORKSPACE_NAME_CHARS = 80;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export type WorkspaceRenameValidation =
  | {
      readonly ok: true;
      readonly name: string;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const RENAME_WORKSPACE_FAILURE_MESSAGES: Record<
  RenameWorkspaceFailureCode,
  string
> = {
  validation:
    "The workspace name was not accepted. Review the naming requirements and try again.",
  conflict: "A workspace with this name already exists.",
  storage:
    "The workspace could not be renamed because local app data is unavailable.",
  unsupported_schema:
    "This app data requires a newer version of OpenDeck Browser before a workspace can be renamed.",
  contract:
    "The workspace could not be renamed because the native response could not be verified.",
  internal: "The workspace could not be renamed.",
};

export function validateWorkspaceNameForRename(
  value: string,
  workspaceId: string,
  workspaces: readonly WorkspaceDto[],
): WorkspaceRenameValidation {
  const name = value.trim();
  const characterCount = Array.from(name).length;

  if (characterCount === 0) {
    return invalid("Enter a workspace name.");
  }

  if (characterCount > MAX_WORKSPACE_NAME_CHARS) {
    return invalid(
      "Workspace names must contain no more than 80 Unicode characters.",
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(name)) {
    return invalid("Workspace names cannot contain control characters.");
  }

  const normalizedName = name.toLowerCase();
  if (
    workspaces.some(
      (workspace) =>
        workspace.id !== workspaceId &&
        workspace.name.toLowerCase() === normalizedName,
    )
  ) {
    return invalid("A workspace with this name already exists.");
  }

  return {
    ok: true,
    name,
  };
}

export function getRenameWorkspaceFailureMessage(
  code: RenameWorkspaceFailureCode,
): string {
  return RENAME_WORKSPACE_FAILURE_MESSAGES[code];
}

function invalid(message: string): WorkspaceRenameValidation {
  return {
    ok: false,
    message,
  };
}
