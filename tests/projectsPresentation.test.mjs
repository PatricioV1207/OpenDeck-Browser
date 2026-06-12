import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectsPresentation,
  formatWorkspaceTimestamp,
} from "../src/features/projects/projectsPresentation.ts";

function workspace(overrides = {}) {
  return {
    id: "workspace-1",
    name: "OpenDeck Browser",
    createdAt: "2026-06-12T10:00:00Z",
    updatedAt: "2026-06-12T11:00:00Z",
    ...overrides,
  };
}

function readyState(workspaces = [], activeWorkspaceId = null) {
  return {
    status: "ready",
    data: {
      schemaVersion: 1,
      settings: {
        colorMode: "system",
        sidebarCollapsed: false,
        statusPanelVisible: true,
      },
      workspaces,
      activeWorkspaceId,
    },
    notices: [],
    error: null,
  };
}

test("maps loading and empty app-data states", () => {
  assert.deepEqual(
    createProjectsPresentation({
      status: "loading",
      data: null,
      notices: [],
      error: null,
    }),
    { status: "loading" },
  );
  assert.deepEqual(createProjectsPresentation(readyState()), {
    status: "empty",
  });
});

test("maps provider failure codes to fixed Projects-owned messages", () => {
  const rawMessage = "/private/path and native diagnostic details";
  const cases = [
    [
      "unsupported_schema",
      "Projects cannot be shown because this app data requires a newer version of OpenDeck Browser.",
    ],
    [
      "storage",
      "Projects are unavailable because local app data could not be loaded safely.",
    ],
    [
      "contract",
      "Projects are unavailable because the native app data response could not be verified.",
    ],
    [
      "internal",
      "Projects are unavailable because local app data could not be loaded.",
    ],
  ];

  for (const [code, expectedMessage] of cases) {
    const presentation = createProjectsPresentation({
      status: "error",
      data: null,
      notices: [],
      error: {
        code,
        message: rawMessage,
      },
    });

    assert.deepEqual(presentation, {
      status: "error",
      message: expectedMessage,
    });
    assert.equal(JSON.stringify(presentation).includes(rawMessage), false);
  }
});

test("preserves canonical workspace order and marks only the active workspace", () => {
  const workspaces = [
    workspace(),
    workspace({
      id: "workspace-2",
      name: "Documentation",
      createdAt: "2026-06-13T08:30:00Z",
      updatedAt: "2026-06-14T09:45:30Z",
    }),
  ];
  const presentation = createProjectsPresentation(
    readyState(workspaces, "workspace-2"),
  );

  assert.equal(presentation.status, "ready");
  assert.equal(presentation.countLabel, "2 workspaces");
  assert.deepEqual(
    presentation.workspaces.map(({ id, isActive }) => ({ id, isActive })),
    [
      { id: "workspace-1", isActive: false },
      { id: "workspace-2", isActive: true },
    ],
  );
});

test("uses a singular count and no active marker when selection is null", () => {
  const presentation = createProjectsPresentation(
    readyState([workspace()], null),
  );

  assert.equal(presentation.status, "ready");
  assert.equal(presentation.countLabel, "1 workspace");
  assert.equal(presentation.workspaces[0].isActive, false);
});

test("formats approved RFC 3339 zero-offset timestamps in deterministic UTC", () => {
  for (const timestamp of [
    "2026-06-12T10:00:00Z",
    "2026-06-12T10:00:00+00:00",
    "2026-06-12T10:00:00-00:00",
    "2026-06-12T10:00:00.123456789Z",
  ]) {
    assert.deepEqual(formatWorkspaceTimestamp(timestamp), {
      dateTime: timestamp,
      label: "12 Jun 2026, 10:00:00 UTC",
    });
  }
});

test("formats leap-day timestamps without using the machine locale", () => {
  assert.deepEqual(formatWorkspaceTimestamp("2024-02-29T00:05:09Z"), {
    dateTime: "2024-02-29T00:05:09Z",
    label: "29 Feb 2024, 00:05:09 UTC",
  });
});

test("returns a fixed fallback without echoing malformed timestamp input", () => {
  for (const timestamp of [
    "/private/path",
    "2026-02-29T10:00:00Z",
    "2026-06-12T24:00:00Z",
    "2026-06-12T10:00:60Z",
    "2026-06-12T10:00:00+01:00",
  ]) {
    const formatted = formatWorkspaceTimestamp(timestamp);

    assert.deepEqual(formatted, {
      dateTime: null,
      label: "Date unavailable",
    });
    assert.equal(JSON.stringify(formatted).includes(timestamp), false);
  }
});
