import assert from "node:assert/strict";
import test from "node:test";

import { executeCreateWorkspace } from "../src/state/appDataActions.ts";
import {
  AppCommandError,
  IpcContractError,
} from "../src/types/appData.ts";

function workspace(overrides = {}) {
  return {
    id: "workspace-1",
    name: "OpenDeck Browser",
    createdAt: "2026-06-15T10:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
    ...overrides,
  };
}

function readyState(overrides = {}) {
  return {
    status: "ready",
    data: {
      schemaVersion: 1,
      settings: {
        colorMode: "system",
        sidebarCollapsed: false,
        statusPanelVisible: true,
      },
      workspaces: [],
      activeWorkspaceId: null,
      ...overrides,
    },
    notices: [],
    error: null,
  };
}

function commandError(code, field, notices = []) {
  return new AppCommandError("create_workspace", {
    code,
    message: "/private/path and native diagnostic details",
    field,
    notices,
  });
}

test("replaces provider state with the canonical successful response", async () => {
  const previous = readyState();
  const response = {
    data: {
      ...previous.data,
      workspaces: [workspace()],
      activeWorkspaceId: "workspace-1",
    },
    notices: [
      {
        code: "corrupt_data_recovered",
        message: "Validated native notice text.",
      },
    ],
  };
  const names = [];

  const outcome = await executeCreateWorkspace(
    previous,
    "OpenDeck Browser",
    async (name) => {
      names.push(name);
      return response;
    },
  );

  assert.deepEqual(names, ["OpenDeck Browser"]);
  assert.deepEqual(outcome.result, { ok: true });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, response.data);
  assert.equal(outcome.state.data.activeWorkspaceId, "workspace-1");
  assert.deepEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices[0], response.notices[0]);
  assert.deepEqual(previous.data.workspaces, []);
});

test("maps supported command failures to safe result codes", async () => {
  const cases = [
    ["validation", "name"],
    ["conflict", "name"],
    ["storage", null],
    ["unsupported_schema", "schemaVersion"],
    ["internal", null],
  ];

  for (const [code, field] of cases) {
    const previous = readyState();
    const outcome = await executeCreateWorkspace(
      previous,
      "OpenDeck Browser",
      async () => {
        throw commandError(code, field);
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code });
    assert.equal(outcome.state, previous);
  }
});

test("maps not-found, mismatched-command, and unexpected failures to internal", async () => {
  const failures = [
    commandError("not_found", "id"),
    commandError("validation", "patch"),
    new AppCommandError("rename_workspace", {
      code: "conflict",
      message: "Raw backend message.",
      field: "name",
      notices: [],
    }),
    new Error("/private/path/token-value"),
    "/private/path/raw-rejection",
  ];

  for (const failure of failures) {
    const previous = readyState();
    const outcome = await executeCreateWorkspace(
      previous,
      "OpenDeck Browser",
      async () => {
        throw failure;
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "internal" });
    assert.equal(outcome.state, previous);
    assert.equal(JSON.stringify(outcome).includes("/private/path"), false);
    assert.equal(JSON.stringify(outcome).includes("Raw backend"), false);
  }
});

test("maps malformed success and error contracts to contract", async () => {
  for (const phase of ["success", "error"]) {
    const previous = readyState();
    const outcome = await executeCreateWorkspace(
      previous,
      "OpenDeck Browser",
      async () => {
        throw new IpcContractError("create_workspace", phase);
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "contract" });
    assert.equal(outcome.state, previous);
  }
});

test("treats a contract failure for another command as internal", async () => {
  const previous = readyState();
  const outcome = await executeCreateWorkspace(
    previous,
    "OpenDeck Browser",
    async () => {
      throw new IpcContractError("rename_workspace", "success");
    },
  );

  assert.deepEqual(outcome.result, { ok: false, code: "internal" });
  assert.equal(outcome.state, previous);
});

test("keeps the canonical snapshot and copies validated failure notices", async () => {
  const previous = readyState({
    workspaces: [workspace()],
    activeWorkspaceId: "workspace-1",
  });
  const notices = [
    {
      code: "corrupt_data_recovered",
      message: "Validated but never rendered directly.",
    },
  ];

  const outcome = await executeCreateWorkspace(
    previous,
    "Duplicate",
    async () => {
      throw commandError("conflict", "name", notices);
    },
  );

  assert.deepEqual(outcome.result, { ok: false, code: "conflict" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, previous.data);
  assert.deepEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices[0], notices[0]);
});

test("does not invoke the command before app data is ready", async () => {
  const states = [
    {
      status: "loading",
      data: null,
      notices: [],
      error: null,
    },
    {
      status: "error",
      data: null,
      notices: [],
      error: {
        code: "storage",
        message: "Safe provider message.",
      },
    },
  ];

  for (const state of states) {
    let calls = 0;
    const outcome = await executeCreateWorkspace(
      state,
      "OpenDeck Browser",
      async () => {
        calls += 1;
        throw new Error("command must not run");
      },
    );

    assert.equal(calls, 0);
    assert.equal(outcome.state, state);
    assert.deepEqual(outcome.result, { ok: false, code: "internal" });
  }
});
