import type {
  AppDataLoadFailureCode,
  AppDataState,
} from "../../state/appDataState.ts";
import type { WorkspaceDto } from "../../types/appData.ts";

export interface ProjectsTimestampPresentation {
  readonly dateTime: string | null;
  readonly label: string;
}

export interface WorkspacePresentation {
  readonly id: string;
  readonly name: string;
  readonly createdAt: ProjectsTimestampPresentation;
  readonly updatedAt: ProjectsTimestampPresentation;
  readonly isActive: boolean;
}

export type ProjectsPresentation =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "error";
      readonly message: string;
    }
  | {
      readonly status: "empty";
    }
  | {
      readonly status: "ready";
      readonly countLabel: string;
      readonly workspaces: readonly WorkspacePresentation[];
    };

const PROJECTS_ERROR_MESSAGES: Record<AppDataLoadFailureCode, string> = {
  unsupported_schema:
    "Projects cannot be shown because this app data requires a newer version of OpenDeck Browser.",
  storage:
    "Projects are unavailable because local app data could not be loaded safely.",
  contract:
    "Projects are unavailable because the native app data response could not be verified.",
  internal: "Projects are unavailable because local app data could not be loaded.",
};

const UTC_TIMESTAMP_PATTERN =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,9})?(?:Z|[+-]00:00)$/;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function createProjectsPresentation(
  state: AppDataState,
): ProjectsPresentation {
  if (state.status === "loading") {
    return { status: "loading" };
  }

  if (state.status === "error") {
    return {
      status: "error",
      message: PROJECTS_ERROR_MESSAGES[state.error.code],
    };
  }

  if (state.data.workspaces.length === 0) {
    return { status: "empty" };
  }

  const workspaces = state.data.workspaces.map((workspace) =>
    createWorkspacePresentation(workspace, state.data.activeWorkspaceId),
  );

  return {
    status: "ready",
    countLabel: `${workspaces.length} ${
      workspaces.length === 1 ? "workspace" : "workspaces"
    }`,
    workspaces,
  };
}

export function formatWorkspaceTimestamp(
  value: string,
): ProjectsTimestampPresentation {
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    return unavailableTimestamp();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return unavailableTimestamp();
  }

  return {
    dateTime: value,
    label: `${match[3]} ${MONTH_NAMES[month - 1]} ${match[1]}, ${match[4]}:${match[5]}:${match[6]} UTC`,
  };
}

function createWorkspacePresentation(
  workspace: WorkspaceDto,
  activeWorkspaceId: string | null,
): WorkspacePresentation {
  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: formatWorkspaceTimestamp(workspace.createdAt),
    updatedAt: formatWorkspaceTimestamp(workspace.updatedAt),
    isActive: workspace.id === activeWorkspaceId,
  };
}

function unavailableTimestamp(): ProjectsTimestampPresentation {
  return {
    dateTime: null,
    label: "Date unavailable",
  };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}
