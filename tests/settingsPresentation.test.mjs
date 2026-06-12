import assert from "node:assert/strict";
import test from "node:test";

import { createSettingsPresentation } from "../src/features/settings/settingsPresentation.ts";

function readyState(settings, overrides = {}) {
  return {
    status: "ready",
    data: {
      schemaVersion: 1,
      settings,
      workspaces: [],
      activeWorkspaceId: null,
      ...overrides,
    },
    notices: [],
    error: null,
  };
}

test("maps the loading app-data state", () => {
  assert.deepEqual(
    createSettingsPresentation({
      status: "loading",
      data: null,
      notices: [],
      error: null,
    }),
    { status: "loading" },
  );
});

test("maps provider failure codes to fixed Settings-owned messages", () => {
  const rawMessage = "/private/path and native diagnostic details";
  const cases = [
    [
      "unsupported_schema",
      "Settings cannot be shown because this app data requires a newer version of OpenDeck Browser.",
    ],
    [
      "storage",
      "Settings are unavailable because local app data could not be loaded safely.",
    ],
    [
      "contract",
      "Settings are unavailable because the native app data response could not be verified.",
    ],
    [
      "internal",
      "Settings are unavailable because local app data could not be loaded.",
    ],
  ];

  for (const [code, expectedMessage] of cases) {
    const presentation = createSettingsPresentation({
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

test("maps every color mode to a human-readable label", () => {
  const cases = [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ];

  for (const [colorMode, expectedValue] of cases) {
    const presentation = createSettingsPresentation(
      readyState({
        colorMode,
        sidebarCollapsed: false,
        statusPanelVisible: true,
      }),
    );

    assert.equal(presentation.status, "ready");
    assert.equal(presentation.rows[0].value, expectedValue);
  }
});

test("maps boolean settings to explicit presentation labels", () => {
  const collapsedAndHidden = createSettingsPresentation(
    readyState({
      colorMode: "light",
      sidebarCollapsed: true,
      statusPanelVisible: false,
    }),
  );
  const expandedAndVisible = createSettingsPresentation(
    readyState({
      colorMode: "light",
      sidebarCollapsed: false,
      statusPanelVisible: true,
    }),
  );

  assert.deepEqual(
    collapsedAndHidden.rows.map((row) => row.value),
    ["Light", "Collapsed", "Hidden"],
  );
  assert.deepEqual(
    expandedAndVisible.rows.map((row) => row.value),
    ["Light", "Expanded", "Visible"],
  );
});

test("keeps stored preference rows in a stable order", () => {
  const presentation = createSettingsPresentation(
    readyState({
      colorMode: "system",
      sidebarCollapsed: false,
      statusPanelVisible: true,
    }),
  );

  assert.deepEqual(
    presentation.rows.map(({ id, name }) => ({ id, name })),
    [
      { id: "color-mode", name: "Color mode" },
      { id: "sidebar-presentation", name: "Sidebar presentation" },
      { id: "status-panel", name: "Status panel" },
    ],
  );
});

test("does not retain notices in the ready presentation", () => {
  const state = readyState({
    colorMode: "system",
    sidebarCollapsed: false,
    statusPanelVisible: true,
  });
  state.notices = [
    {
      code: "corrupt_data_recovered",
      message: "Arbitrary notice text.",
    },
  ];

  const presentation = createSettingsPresentation(state);

  assert.equal(JSON.stringify(presentation).includes("Arbitrary"), false);
  assert.equal("notices" in presentation, false);
});

test("ignores workspace records and active workspace state", () => {
  const settings = {
    colorMode: "dark",
    sidebarCollapsed: true,
    statusPanelVisible: false,
  };
  const withoutWorkspaces = createSettingsPresentation(readyState(settings));
  const withWorkspaces = createSettingsPresentation(
    readyState(settings, {
      workspaces: [
        {
          id: "workspace-1",
          name: "OpenDeck Browser",
          createdAt: "2026-06-12T10:00:00Z",
          updatedAt: "2026-06-12T11:00:00Z",
        },
      ],
      activeWorkspaceId: "workspace-1",
    }),
  );

  assert.deepEqual(withWorkspaces, withoutWorkspaces);
});
