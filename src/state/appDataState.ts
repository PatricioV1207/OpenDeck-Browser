import {
  AppCommandError,
  IpcContractError,
  type AppDataDto,
  type AppDataResponseDto,
  type AppNoticeDto,
} from "../types/appData.ts";

export type AppDataLoadFailureCode =
  | "unsupported_schema"
  | "storage"
  | "contract"
  | "internal";

export interface AppDataLoadFailure {
  readonly code: AppDataLoadFailureCode;
  readonly message: string;
}

export type AppDataState =
  | {
      readonly status: "loading";
      readonly data: null;
      readonly notices: readonly AppNoticeDto[];
      readonly error: null;
    }
  | {
      readonly status: "ready";
      readonly data: AppDataDto;
      readonly notices: readonly AppNoticeDto[];
      readonly error: null;
    }
  | {
      readonly status: "error";
      readonly data: null;
      readonly notices: readonly AppNoticeDto[];
      readonly error: AppDataLoadFailure;
    };

export interface AppDataStatusText {
  readonly primary: string;
  readonly notice: string | null;
}

const LOAD_FAILURE_MESSAGES: Record<AppDataLoadFailureCode, string> = {
  unsupported_schema:
    "This app data requires a newer version of OpenDeck Browser.",
  storage: "Local app data could not be loaded safely.",
  contract: "OpenDeck Browser could not verify the native app data response.",
  internal: "OpenDeck Browser could not load local app data.",
};

const NOTICE_MESSAGES: Record<AppNoticeDto["code"], string> = {
  corrupt_data_recovered: "App data recovered with safe defaults.",
};

export const initialAppDataState: AppDataState = {
  status: "loading",
  data: null,
  notices: [],
  error: null,
};

export function createReadyAppDataState(
  response: AppDataResponseDto,
): AppDataState {
  return {
    status: "ready",
    data: response.data,
    notices: copyNotices(response.notices),
    error: null,
  };
}

export function createErrorAppDataState(error: unknown): AppDataState {
  const failureCode = getFailureCode(error);
  const notices =
    error instanceof AppCommandError ? copyNotices(error.notices) : [];

  return {
    status: "error",
    data: null,
    notices,
    error: {
      code: failureCode,
      message: LOAD_FAILURE_MESSAGES[failureCode],
    },
  };
}

export function getAppDataStatusText(state: AppDataState): AppDataStatusText {
  const notice = state.notices[0];
  const noticeText = notice === undefined ? null : NOTICE_MESSAGES[notice.code];

  if (state.status === "loading") {
    return {
      primary: "Loading local app data",
      notice: noticeText,
    };
  }

  if (state.status === "error") {
    return {
      primary: state.error.message,
      notice: noticeText,
    };
  }

  return {
    primary: "Local app data ready",
    notice: noticeText,
  };
}

export function createSingleFlightLoader<T>(
  loader: () => Promise<T>,
): () => Promise<T> {
  let result: Promise<T> | null = null;

  return () => {
    result ??= Promise.resolve().then(loader);
    return result;
  };
}

function getFailureCode(error: unknown): AppDataLoadFailureCode {
  if (error instanceof IpcContractError) {
    return "contract";
  }

  if (error instanceof AppCommandError) {
    if (error.code === "unsupported_schema") {
      return "unsupported_schema";
    }

    if (error.code === "storage") {
      return "storage";
    }
  }

  return "internal";
}

function copyNotices(
  notices: readonly AppNoticeDto[],
): readonly AppNoticeDto[] {
  return notices.map((notice) => ({ ...notice }));
}
