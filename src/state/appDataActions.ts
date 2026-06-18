import type { AppDataState } from "./appDataState.ts";
import { createReadyAppDataState } from "./appDataState.ts";
import {
  AppCommandError,
  IpcContractError,
  type AppDataResponseDto,
  type AppNoticeDto,
} from "../types/appData.ts";

export type CreateWorkspaceFailureCode =
  | "validation"
  | "conflict"
  | "storage"
  | "unsupported_schema"
  | "contract"
  | "internal";

export type CreateWorkspaceResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly code: CreateWorkspaceFailureCode;
    };

export interface CreateWorkspaceActionOutcome {
  readonly state: AppDataState;
  readonly result: CreateWorkspaceResult;
}

export type CreateWorkspaceCommand = (
  name: string,
) => Promise<AppDataResponseDto>;

export type RenameWorkspaceFailureCode = CreateWorkspaceFailureCode;

export type RenameWorkspaceResult =
  | {
      readonly ok: true;
      readonly outcome: "renamed" | "unchanged";
    }
  | {
      readonly ok: false;
      readonly code: RenameWorkspaceFailureCode;
    };

export interface RenameWorkspaceActionOutcome {
  readonly state: AppDataState;
  readonly result: RenameWorkspaceResult;
}

export type RenameWorkspaceCommand = (
  id: string,
  name: string,
) => Promise<AppDataResponseDto>;

export interface AppDataMutationQueue {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
}

export async function executeCreateWorkspace(
  state: AppDataState,
  name: string,
  command: CreateWorkspaceCommand,
): Promise<CreateWorkspaceActionOutcome> {
  if (state.status !== "ready") {
    return failedOutcome(state, "internal");
  }

  try {
    const response = await command(name);

    return {
      state: createReadyAppDataState(response),
      result: { ok: true },
    };
  } catch (error: unknown) {
    return failedOutcome(
      stateWithFailureNotices(state, error, "create_workspace"),
      mapCreateWorkspaceFailure(error),
    );
  }
}

export async function executeRenameWorkspace(
  state: AppDataState,
  id: string,
  name: string,
  command: RenameWorkspaceCommand,
): Promise<RenameWorkspaceActionOutcome> {
  if (state.status !== "ready") {
    return failedRenameOutcome(state, "internal");
  }

  const currentWorkspace = state.data.workspaces.find(
    (workspace) => workspace.id === id,
  );
  if (currentWorkspace === undefined) {
    return failedRenameOutcome(state, "internal");
  }

  try {
    const response = await command(id, name);
    const renamedWorkspace = response.data.workspaces.find(
      (workspace) => workspace.id === id,
    );

    if (renamedWorkspace === undefined) {
      return failedRenameOutcome(state, "internal");
    }

    const unchanged =
      renamedWorkspace.name === currentWorkspace.name &&
      renamedWorkspace.updatedAt === currentWorkspace.updatedAt;

    return {
      state: createReadyAppDataState(response),
      result: {
        ok: true,
        outcome: unchanged ? "unchanged" : "renamed",
      },
    };
  } catch (error: unknown) {
    return failedRenameOutcome(
      stateWithFailureNotices(state, error, "rename_workspace"),
      mapRenameWorkspaceFailure(error),
    );
  }
}

export function createAppDataMutationQueue(): AppDataMutationQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

function mapCreateWorkspaceFailure(
  error: unknown,
): CreateWorkspaceFailureCode {
  if (error instanceof IpcContractError) {
    return error.command === "create_workspace" ? "contract" : "internal";
  }

  if (
    error instanceof AppCommandError &&
    error.command === "create_workspace"
  ) {
    switch (error.code) {
      case "validation":
        return error.field === "name" ? "validation" : "internal";
      case "conflict":
        return error.field === "name" ? "conflict" : "internal";
      case "storage":
        return error.field === null ? "storage" : "internal";
      case "unsupported_schema":
        return error.field === "schemaVersion"
          ? "unsupported_schema"
          : "internal";
      case "internal":
      case "not_found":
        return "internal";
    }
  }

  return "internal";
}

function mapRenameWorkspaceFailure(
  error: unknown,
): RenameWorkspaceFailureCode {
  if (error instanceof IpcContractError) {
    return error.command === "rename_workspace" ? "contract" : "internal";
  }

  if (
    error instanceof AppCommandError &&
    error.command === "rename_workspace"
  ) {
    switch (error.code) {
      case "validation":
        return error.field === "name" ? "validation" : "internal";
      case "conflict":
        return error.field === "name" ? "conflict" : "internal";
      case "storage":
        return error.field === null ? "storage" : "internal";
      case "unsupported_schema":
        return error.field === "schemaVersion"
          ? "unsupported_schema"
          : "internal";
      case "internal":
      case "not_found":
        return "internal";
    }
  }

  return "internal";
}

function stateWithFailureNotices(
  state: Extract<AppDataState, { status: "ready" }>,
  error: unknown,
  command: "create_workspace" | "rename_workspace",
): AppDataState {
  if (
    !(error instanceof AppCommandError) ||
    error.command !== command ||
    error.notices.length === 0
  ) {
    return state;
  }

  return {
    ...state,
    notices: copyNotices(error.notices),
  };
}

function failedOutcome(
  state: AppDataState,
  code: CreateWorkspaceFailureCode,
): CreateWorkspaceActionOutcome {
  return {
    state,
    result: {
      ok: false,
      code,
    },
  };
}

function failedRenameOutcome(
  state: AppDataState,
  code: RenameWorkspaceFailureCode,
): RenameWorkspaceActionOutcome {
  return {
    state,
    result: {
      ok: false,
      code,
    },
  };
}

function copyNotices(
  notices: readonly AppNoticeDto[],
): readonly AppNoticeDto[] {
  return notices.map((notice) => ({ ...notice }));
}
