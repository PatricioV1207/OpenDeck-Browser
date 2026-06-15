import assert from "node:assert/strict";
import test from "node:test";

import { createHomePresentation } from "../src/features/home/homePresentation.ts";

function workspace(overrides = {}) {
  return {
    id: "workspace-1",
    name: "OpenDeck Browser",
    createdAt: "2026-06-12T10:00:00Z",
    updatedAt: "2026-06-12T11:00:00Z",
    ...overrides,
  };
}

function readyState({
  colorMode = "system",
  workspaces = [],
  activeWorkspaceId = null,
  notices = [],
} = {}) {
  return {
    status: "ready",
    data: {
      schemaVersion: 1,
      settings: {
        colorMode,
        sidebarCollapsed: false,
        statusPanelVisible: true,
      },
      workspaces,
      activeWorkspaceId,
    },
    notices,
    error: null,
  };
}

test("maps the loading app-data state", () => {
  assert.deepEqual(
    createHomePresentation({
      status: "loading",
      data: null,
      notices: [],
      error: null,
    }),
    { status: "loading" },
  );
});

test("maps provider failure codes to fixed Home-owned messages", () => {
  const rawMessage = "/private/path and native diagnostic details";
  const cases = [
    [
      "unsupported_schema",
      "Home cannot show an app-data summary because this data requires a newer version of OpenDeck Browser.",
    ],
    [
      "storage",
      "The app-data summary is unavailable because local app data could not be loaded safely.",
    ],
    [
      "contract",
      "The app-data summary is unavailable because the native response could not be verified.",
    ],
    [
      "internal",
      "The app-data summary is unavailable because local app data could not be loaded.",
    ],
  ];

  for (const [code, expectedMessage] of cases) {
    const presentation = createHomePresentation({
      status: "error",
      data: null,
      notices: [
        {
          code: "corrupt_data_recovered",
          message: "Arbitrary notice text.",
        },
      ],
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
    assert.equal(JSON.stringify(presentation).includes("Arbitrary"), false);
  }
});

test("maps zero, singular, and plural workspace counts", () => {
  const cases = [
    [[], "0 workspaces"],
    [[workspace()], "1 workspace"],
    [
      [
        workspace(),
        workspace({ id: "workspace-2", name: "Documentation" }),
      ],
      "2 workspaces",
    ],
  ];

  for (const [workspaces, expectedCount] of cases) {
    const presentation = createHomePresentation(readyState({ workspaces }));

    assert.equal(presentation.status, "ready");
    assert.equal(presentation.summary.workspaceCount, expectedCount);
  }
});

test("shows the active workspace name without changing canonical data", () => {
  const workspaces = [
    workspace(),
    workspace({ id: "workspace-2", name: "Documentation" }),
  ];
  const state = readyState({
    workspaces,
    activeWorkspaceId: "workspace-2",
  });
  const before = structuredClone(state);

  const presentation = createHomePresentation(state);

  assert.equal(presentation.status, "ready");
  assert.equal(presentation.summary.activeWorkspaceName, "Documentation");
  assert.deepEqual(state, before);
});

test("uses a fixed active-workspace fallback for null or unresolved IDs", () => {
  for (const activeWorkspaceId of [null, "workspace-99"]) {
    const presentation = createHomePresentation(
      readyState({
        workspaces: [workspace()],
        activeWorkspaceId,
      }),
    );

    assert.equal(presentation.status, "ready");
    assert.equal(
      presentation.summary.activeWorkspaceName,
      "No active workspace",
    );
  }
});

test("maps every stored color mode to a human-readable label", () => {
  const cases = [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ];

  for (const [colorMode, expectedLabel] of cases) {
    const presentation = createHomePresentation(readyState({ colorMode }));

    assert.equal(presentation.status, "ready");
    assert.equal(presentation.summary.colorMode, expectedLabel);
  }
});

test("uses a fixed app-data status and excludes recovery notices", () => {
  const presentation = createHomePresentation(
    readyState({
      notices: [
        {
          code: "corrupt_data_recovered",
          message: "Arbitrary notice text.",
        },
      ],
    }),
  );

  assert.equal(presentation.status, "ready");
  assert.equal(
    presentation.summary.appDataStatus,
    "Loaded and validated",
  );
  assert.equal(JSON.stringify(presentation).includes("Arbitrary"), false);
  assert.equal("notices" in presentation, false);
});
