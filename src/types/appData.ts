export type AppDataCommand =
  | "get_app_info"
  | "load_app_data"
  | "create_workspace"
  | "rename_workspace"
  | "delete_workspace"
  | "set_active_workspace"
  | "update_settings";

export type ColorMode = "system" | "light" | "dark";

export interface AppInfoDto {
  readonly productName: string;
  readonly version: string;
  readonly supportedSchemaVersion: 1;
}

export interface AppSettingsDto {
  readonly colorMode: ColorMode;
  readonly sidebarCollapsed: boolean;
  readonly statusPanelVisible: boolean;
}

export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppDataDto {
  readonly schemaVersion: 1;
  readonly settings: AppSettingsDto;
  readonly workspaces: readonly WorkspaceDto[];
  readonly activeWorkspaceId: string | null;
}

export type AppNoticeCode = "corrupt_data_recovered";

export interface AppNoticeDto {
  readonly code: AppNoticeCode;
  readonly message: string;
}

export interface AppDataResponseDto {
  readonly data: AppDataDto;
  readonly notices: readonly AppNoticeDto[];
}

export type AppCommandErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "storage"
  | "unsupported_schema"
  | "internal";

export type AppCommandErrorField =
  | "name"
  | "id"
  | "patch"
  | "schemaVersion";

export interface AppCommandErrorDto {
  readonly code: AppCommandErrorCode;
  readonly message: string;
  readonly field: AppCommandErrorField | null;
  readonly notices: readonly AppNoticeDto[];
}

export interface AppSettingsPatch {
  readonly colorMode?: ColorMode;
  readonly sidebarCollapsed?: boolean;
  readonly statusPanelVisible?: boolean;
}

export type IpcContractPhase = "success" | "error";

export class AppCommandError extends Error {
  readonly command: AppDataCommand;
  readonly code: AppCommandErrorCode;
  readonly field: AppCommandErrorField | null;
  readonly notices: readonly AppNoticeDto[];

  constructor(command: AppDataCommand, error: AppCommandErrorDto) {
    super(error.message);
    this.name = "AppCommandError";
    this.command = command;
    this.code = error.code;
    this.field = error.field;
    this.notices = error.notices.map((notice) => ({ ...notice }));
  }
}

export class IpcContractError extends Error {
  readonly command: AppDataCommand;
  readonly phase: IpcContractPhase;

  constructor(command: AppDataCommand, phase: IpcContractPhase) {
    super("OpenDeck Browser received an invalid response from native code.");
    this.name = "IpcContractError";
    this.command = command;
    this.phase = phase;
  }
}
