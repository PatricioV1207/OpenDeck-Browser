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
      stateWithFailureNotices(state, error),
      mapCreateWorkspaceFailure(error),
    );
  }
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

function stateWithFailureNotices(
  state: Extract<AppDataState, { status: "ready" }>,
  error: unknown,
): AppDataState {
  if (
    !(error instanceof AppCommandError) ||
    error.command !== "create_workspace" ||
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

function copyNotices(
  notices: readonly AppNoticeDto[],
): readonly AppNoticeDto[] {
  return notices.map((notice) => ({ ...notice }));
}
