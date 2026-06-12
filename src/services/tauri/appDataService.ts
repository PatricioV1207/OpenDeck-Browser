import { invoke } from "@tauri-apps/api/core";

import {
  type AppDataCommand,
  type AppDataResponseDto,
  type AppInfoDto,
  type AppSettingsPatch,
} from "../../types/appData.ts";
import {
  parseAppDataResponseDto,
  parseAppInfoDto,
  toAppCommandError,
} from "./appDataGuards.ts";

type SuccessParser<T> = (value: unknown) => T;

export function getAppInfo(): Promise<AppInfoDto> {
  return invokeAppDataCommand("get_app_info", undefined, parseAppInfoDto);
}

export function loadAppData(): Promise<AppDataResponseDto> {
  return invokeForAppData("load_app_data");
}

export function createWorkspace(
  name: string,
): Promise<AppDataResponseDto> {
  return invokeForAppData("create_workspace", {
    input: { name },
  });
}

export function renameWorkspace(
  id: string,
  name: string,
): Promise<AppDataResponseDto> {
  return invokeForAppData("rename_workspace", {
    input: { id, name },
  });
}

export function deleteWorkspace(id: string): Promise<AppDataResponseDto> {
  return invokeForAppData("delete_workspace", {
    input: { id },
  });
}

export function setActiveWorkspace(
  id: string | null,
): Promise<AppDataResponseDto> {
  return invokeForAppData("set_active_workspace", {
    input: { id },
  });
}

export function updateSettings(
  patch: AppSettingsPatch,
): Promise<AppDataResponseDto> {
  return invokeForAppData("update_settings", {
    input: { patch },
  });
}

function invokeForAppData(
  command: Exclude<AppDataCommand, "get_app_info">,
  args?: Record<string, unknown>,
): Promise<AppDataResponseDto> {
  return invokeAppDataCommand(command, args, (value) =>
    parseAppDataResponseDto(value, command),
  );
}

async function invokeAppDataCommand<T>(
  command: AppDataCommand,
  args: Record<string, unknown> | undefined,
  parseSuccess: SuccessParser<T>,
): Promise<T> {
  let value: unknown;

  try {
    value = await invoke<unknown>(command, args);
  } catch (rejectedValue: unknown) {
    throw toAppCommandError(command, rejectedValue);
  }

  return parseSuccess(value);
}
