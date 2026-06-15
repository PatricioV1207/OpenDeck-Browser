import type { CreateWorkspaceFailureCode } from "../../state/appDataActions.ts";
import type { WorkspaceDto } from "../../types/appData.ts";

const MAX_WORKSPACES = 1_000;
const MAX_WORKSPACE_NAME_CHARS = 80;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

export type WorkspaceNameValidation =
  | {
      readonly ok: true;
      readonly name: string;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const CREATE_WORKSPACE_FAILURE_MESSAGES: Record<
  CreateWorkspaceFailureCode,
  string
> = {
  validation:
    "The workspace name was not accepted. Review the naming requirements and try again.",
  conflict:
    "A workspace with this name already exists, or the workspace limit has been reached.",
  storage:
    "The workspace could not be saved because local app data is unavailable.",
  unsupported_schema:
    "This app data requires a newer version of OpenDeck Browser before a workspace can be created.",
  contract:
    "The workspace could not be created because the native response could not be verified.",
  internal: "The workspace could not be created.",
};

export function validateWorkspaceNameForCreate(
  value: string,
  workspaces: readonly WorkspaceDto[],
): WorkspaceNameValidation {
  if (workspaces.length >= MAX_WORKSPACES) {
    return invalid("OpenDeck Browser supports up to 1,000 workspaces.");
  }

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
      (workspace) => workspace.name.toLowerCase() === normalizedName,
    )
  ) {
    return invalid("A workspace with this name already exists.");
  }

  return {
    ok: true,
    name,
  };
}

export function getCreateWorkspaceFailureMessage(
  code: CreateWorkspaceFailureCode,
): string {
  return CREATE_WORKSPACE_FAILURE_MESSAGES[code];
}

function invalid(message: string): WorkspaceNameValidation {
  return {
    ok: false,
    message,
  };
}
