import {
  AppCommandError,
  IpcContractError,
  type AppCommandErrorCode,
  type AppCommandErrorDto,
  type AppCommandErrorField,
  type AppDataCommand,
  type AppDataDto,
  type AppDataResponseDto,
  type AppInfoDto,
  type AppNoticeDto,
  type AppSettingsDto,
  type ColorMode,
  type IpcContractPhase,
  type WorkspaceDto,
} from "../../types/appData.ts";

const MAX_WORKSPACES = 1_000;
const MAX_WORKSPACE_NAME_CHARS = 80;
const MAX_U64_DECIMAL = "18446744073709551615";
const WORKSPACE_ID_PATTERN = /^workspace-([1-9][0-9]*)$/;
const RFC_3339_UTC_PATTERN =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-]00:00)$/;
const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

class ContractViolation extends Error {}

type UnknownRecord = Record<string, unknown>;
type ParsedTimestamp = readonly [
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  nanosecond: number,
];

export function parseAppInfoDto(value: unknown): AppInfoDto {
  return parseContract("get_app_info", "success", () => {
    const record = exactRecord(value, [
      "productName",
      "version",
      "supportedSchemaVersion",
    ]);

    if (
      record.productName !== "OpenDeck Browser" ||
      typeof record.version !== "string" ||
      record.version.length === 0 ||
      record.supportedSchemaVersion !== 1
    ) {
      throw new ContractViolation();
    }

    return {
      productName: record.productName,
      version: record.version,
      supportedSchemaVersion: 1,
    };
  });
}

export function parseAppDataResponseDto(
  value: unknown,
  command: AppDataCommand = "load_app_data",
): AppDataResponseDto {
  return parseContract(command, "success", () => {
    const record = exactRecord(value, ["data", "notices"]);

    return {
      data: parseAppData(record.data),
      notices: parseNotices(record.notices),
    };
  });
}

export function parseAppCommandErrorDto(
  value: unknown,
  command: AppDataCommand,
): AppCommandErrorDto {
  return parseContract(command, "error", () => {
    const record = exactRecord(value, ["code", "message", "field", "notices"]);
    const code = parseErrorCode(record.code);
    const field = parseErrorField(record.field);

    if (
      typeof record.message !== "string" ||
      !isValidErrorFieldForCode(code, field)
    ) {
      throw new ContractViolation();
    }

    return {
      code,
      message: record.message,
      field,
      notices: parseNotices(record.notices),
    };
  });
}

export function toAppCommandError(
  command: AppDataCommand,
  rejectedValue: unknown,
): AppCommandError {
  return new AppCommandError(
    command,
    parseAppCommandErrorDto(rejectedValue, command),
  );
}

function parseAppData(value: unknown): AppDataDto {
  const record = exactRecord(value, [
    "schemaVersion",
    "settings",
    "workspaces",
    "activeWorkspaceId",
  ]);

  if (record.schemaVersion !== 1 || !Array.isArray(record.workspaces)) {
    throw new ContractViolation();
  }

  if (record.workspaces.length > MAX_WORKSPACES) {
    throw new ContractViolation();
  }

  const settings = parseSettings(record.settings);
  const workspaces = record.workspaces.map(parseWorkspace);
  validateWorkspaceCollection(workspaces);

  const activeWorkspaceId = record.activeWorkspaceId;
  if (
    activeWorkspaceId !== null &&
    (typeof activeWorkspaceId !== "string" ||
      !workspaces.some((workspace) => workspace.id === activeWorkspaceId))
  ) {
    throw new ContractViolation();
  }

  return {
    schemaVersion: 1,
    settings,
    workspaces,
    activeWorkspaceId,
  };
}

function parseSettings(value: unknown): AppSettingsDto {
  const record = exactRecord(value, [
    "colorMode",
    "sidebarCollapsed",
    "statusPanelVisible",
  ]);

  if (
    !isColorMode(record.colorMode) ||
    typeof record.sidebarCollapsed !== "boolean" ||
    typeof record.statusPanelVisible !== "boolean"
  ) {
    throw new ContractViolation();
  }

  return {
    colorMode: record.colorMode,
    sidebarCollapsed: record.sidebarCollapsed,
    statusPanelVisible: record.statusPanelVisible,
  };
}

function parseWorkspace(value: unknown): WorkspaceDto {
  const record = exactRecord(value, [
    "id",
    "name",
    "createdAt",
    "updatedAt",
  ]);

  if (
    typeof record.id !== "string" ||
    !isCanonicalWorkspaceId(record.id) ||
    typeof record.name !== "string" ||
    !isValidWorkspaceName(record.name) ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new ContractViolation();
  }

  const createdAt = parseUtcTimestamp(record.createdAt);
  const updatedAt = parseUtcTimestamp(record.updatedAt);
  if (
    createdAt === null ||
    updatedAt === null ||
    compareTimestamps(updatedAt, createdAt) < 0
  ) {
    throw new ContractViolation();
  }

  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseNotices(value: unknown): readonly AppNoticeDto[] {
  if (!Array.isArray(value)) {
    throw new ContractViolation();
  }

  return value.map((notice) => {
    const record = exactRecord(notice, ["code", "message"]);

    if (
      record.code !== "corrupt_data_recovered" ||
      typeof record.message !== "string"
    ) {
      throw new ContractViolation();
    }

    return {
      code: record.code,
      message: record.message,
    };
  });
}

function validateWorkspaceCollection(
  workspaces: readonly WorkspaceDto[],
): void {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const workspace of workspaces) {
    const normalizedName = workspace.name.toLowerCase();
    if (ids.has(workspace.id) || names.has(normalizedName)) {
      throw new ContractViolation();
    }

    ids.add(workspace.id);
    names.add(normalizedName);
  }
}

function isColorMode(value: unknown): value is ColorMode {
  return value === "system" || value === "light" || value === "dark";
}

function isCanonicalWorkspaceId(value: string): boolean {
  const match = WORKSPACE_ID_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const sequence = match[1];
  return (
    sequence.length < MAX_U64_DECIMAL.length ||
    (sequence.length === MAX_U64_DECIMAL.length &&
      sequence <= MAX_U64_DECIMAL)
  );
}

function isValidWorkspaceName(value: string): boolean {
  const characterCount = Array.from(value).length;

  return (
    value.length > 0 &&
    value.trim() === value &&
    characterCount <= MAX_WORKSPACE_NAME_CHARS &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function parseUtcTimestamp(value: string): ParsedTimestamp | null {
  const match = RFC_3339_UTC_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const nanosecond = Number((match[7] ?? "").padEnd(9, "0"));

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  return [year, month, day, hour, minute, second, nanosecond];
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return month === 4 || month === 6 || month === 9 || month === 11
    ? 30
    : 31;
}

function compareTimestamps(
  left: ParsedTimestamp,
  right: ParsedTimestamp,
): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function parseErrorCode(value: unknown): AppCommandErrorCode {
  if (
    value !== "validation" &&
    value !== "not_found" &&
    value !== "conflict" &&
    value !== "storage" &&
    value !== "unsupported_schema" &&
    value !== "internal"
  ) {
    throw new ContractViolation();
  }

  return value;
}

function parseErrorField(value: unknown): AppCommandErrorField | null {
  if (
    value !== null &&
    value !== "name" &&
    value !== "id" &&
    value !== "patch" &&
    value !== "schemaVersion"
  ) {
    throw new ContractViolation();
  }

  return value;
}

function isValidErrorFieldForCode(
  code: AppCommandErrorCode,
  field: AppCommandErrorField | null,
): boolean {
  switch (code) {
    case "validation":
      return field === "name" || field === "patch";
    case "not_found":
      return field === "id";
    case "conflict":
      return field === "name";
    case "unsupported_schema":
      return field === "schemaVersion";
    case "storage":
    case "internal":
      return field === null;
  }
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): UnknownRecord {
  if (!isRecord(value)) {
    throw new ContractViolation();
  }

  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some(
      (key) => !Object.prototype.hasOwnProperty.call(value, key),
    )
  ) {
    throw new ContractViolation();
  }

  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseContract<T>(
  command: AppDataCommand,
  phase: IpcContractPhase,
  parser: () => T,
): T {
  try {
    return parser();
  } catch {
    throw new IpcContractError(command, phase);
  }
}
