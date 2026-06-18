import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppDataMutationQueue,
  executeCreateWorkspace,
  executeRenameWorkspace,
  executeSetActiveWorkspace,
} from "../src/state/appDataActions.ts";
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

function commandError(
  code,
  field,
  notices = [],
  command = "create_workspace",
) {
  return new AppCommandError(command, {
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

test("rename replaces provider state with the canonical successful response", async () => {
  const original = workspace();
  const previous = readyState({
    workspaces: [original],
    activeWorkspaceId: original.id,
  });
  const canonicalWorkspace = workspace({
    name: "OpenDeck Maintainers",
    updatedAt: "2026-06-15T11:00:00Z",
  });
  const response = {
    data: {
      ...previous.data,
      workspaces: [canonicalWorkspace],
    },
    notices: [
      {
        code: "corrupt_data_recovered",
        message: "Validated native notice text.",
      },
    ],
  };
  const calls = [];

  const outcome = await executeRenameWorkspace(
    previous,
    original.id,
    "OpenDeck Maintainers",
    async (id, name) => {
      calls.push({ id, name });
      return response;
    },
  );

  assert.deepEqual(calls, [
    {
      id: "workspace-1",
      name: "OpenDeck Maintainers",
    },
  ]);
  assert.deepEqual(outcome.result, { ok: true, outcome: "renamed" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, response.data);
  assert.equal(outcome.state.data.workspaces[0], canonicalWorkspace);
  assert.deepEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices[0], response.notices[0]);
  assert.equal(previous.data.workspaces[0], original);
});

test("rename reports unchanged only from the canonical response", async () => {
  const original = workspace();
  const previous = readyState({
    workspaces: [original],
    activeWorkspaceId: original.id,
  });
  const response = {
    data: {
      ...previous.data,
      workspaces: [{ ...original }],
    },
    notices: [],
  };

  const outcome = await executeRenameWorkspace(
    previous,
    original.id,
    "  OpenDeck Browser  ",
    async () => response,
  );

  assert.deepEqual(outcome.result, { ok: true, outcome: "unchanged" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, response.data);
});

test("rename maps supported command failures to safe result codes", async () => {
  const cases = [
    ["validation", "name"],
    ["conflict", "name"],
    ["storage", null],
    ["unsupported_schema", "schemaVersion"],
    ["internal", null],
  ];

  for (const [code, field] of cases) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeRenameWorkspace(
      previous,
      "workspace-1",
      "Renamed",
      async () => {
        throw commandError(code, field, [], "rename_workspace");
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code });
    assert.equal(outcome.state, previous);
  }
});

test("rename maps not-found, mismatched fields, commands, and unexpected failures to internal", async () => {
  const failures = [
    commandError("not_found", "id", [], "rename_workspace"),
    commandError("validation", "id", [], "rename_workspace"),
    commandError("conflict", "patch", [], "rename_workspace"),
    commandError("conflict", "name"),
    new IpcContractError("create_workspace", "success"),
    new Error("/private/path/token-value"),
    "/private/path/raw-rejection",
  ];

  for (const failure of failures) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeRenameWorkspace(
      previous,
      "workspace-1",
      "Renamed",
      async () => {
        throw failure;
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "internal" });
    assert.equal(outcome.state, previous);
    assert.equal(JSON.stringify(outcome).includes("/private/path"), false);
  }
});

test("rename maps malformed success and error contracts to contract", async () => {
  for (const phase of ["success", "error"]) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeRenameWorkspace(
      previous,
      "workspace-1",
      "Renamed",
      async () => {
        throw new IpcContractError("rename_workspace", phase);
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "contract" });
    assert.equal(outcome.state, previous);
  }
});

test("rename preserves validated command failure notices without changing data", async () => {
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

  const outcome = await executeRenameWorkspace(
    previous,
    "workspace-1",
    "Duplicate",
    async () => {
      throw commandError("conflict", "name", notices, "rename_workspace");
    },
  );

  assert.deepEqual(outcome.result, { ok: false, code: "conflict" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, previous.data);
  assert.deepEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices[0], notices[0]);
});

test("rename rejects unavailable and missing targets without invoking the command", async () => {
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
    readyState(),
  ];

  for (const state of states) {
    let calls = 0;
    const outcome = await executeRenameWorkspace(
      state,
      "workspace-404",
      "Renamed",
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

test("rename rejects a canonical response that omits the target workspace", async () => {
  const previous = readyState({
    workspaces: [workspace()],
  });
  const response = {
    data: {
      ...previous.data,
      workspaces: [],
      activeWorkspaceId: null,
    },
    notices: [],
  };

  const outcome = await executeRenameWorkspace(
    previous,
    "workspace-1",
    "Renamed",
    async () => response,
  );

  assert.deepEqual(outcome.result, { ok: false, code: "internal" });
  assert.equal(outcome.state, previous);
});

test("active selection replaces provider state with the canonical successful response", async () => {
  const first = workspace();
  const second = workspace({
    id: "workspace-2",
    name: "Documentation",
    createdAt: "2026-06-15T12:00:00Z",
    updatedAt: "2026-06-15T12:00:00Z",
  });
  const previous = readyState({
    workspaces: [first, second],
    activeWorkspaceId: first.id,
  });
  const response = {
    data: {
      ...previous.data,
      activeWorkspaceId: second.id,
    },
    notices: [
      {
        code: "corrupt_data_recovered",
        message: "Validated native notice text.",
      },
    ],
  };
  const calls = [];

  const outcome = await executeSetActiveWorkspace(
    previous,
    second.id,
    async (id) => {
      calls.push(id);
      return response;
    },
  );

  assert.deepEqual(calls, [second.id]);
  assert.deepEqual(outcome.result, { ok: true, outcome: "changed" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, response.data);
  assert.equal(outcome.state.data.activeWorkspaceId, second.id);
  assert.deepEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices, response.notices);
  assert.notEqual(outcome.state.notices[0], response.notices[0]);
  assert.equal(previous.data.activeWorkspaceId, first.id);
});

test("active selection reports unchanged only from a canonical already-active response", async () => {
  const current = workspace();
  const previous = readyState({
    workspaces: [current],
    activeWorkspaceId: current.id,
  });
  const response = {
    data: {
      ...previous.data,
      workspaces: [{ ...current }],
      activeWorkspaceId: current.id,
    },
    notices: [],
  };

  const outcome = await executeSetActiveWorkspace(
    previous,
    current.id,
    async () => response,
  );

  assert.deepEqual(outcome.result, { ok: true, outcome: "unchanged" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, response.data);
});

test("active selection rejects unavailable and missing targets without invoking the command", async () => {
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
    readyState(),
  ];

  for (const state of states) {
    let calls = 0;
    const outcome = await executeSetActiveWorkspace(
      state,
      "workspace-404",
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

test("active selection maps supported command failures to safe result codes", async () => {
  const cases = [
    ["storage", null, "storage"],
    ["unsupported_schema", "schemaVersion", "unsupported_schema"],
    ["internal", null, "internal"],
  ];

  for (const [code, field, expected] of cases) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeSetActiveWorkspace(
      previous,
      "workspace-1",
      async () => {
        throw commandError(code, field, [], "set_active_workspace");
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: expected });
    assert.equal(outcome.state, previous);
  }
});

test("active selection maps not-found, validation, conflict, mismatches, and unexpected failures to internal", async () => {
  const failures = [
    commandError("not_found", "id", [], "set_active_workspace"),
    commandError("validation", "id", [], "set_active_workspace"),
    commandError("conflict", "id", [], "set_active_workspace"),
    commandError("storage", "id", [], "set_active_workspace"),
    commandError("unsupported_schema", null, [], "set_active_workspace"),
    commandError("storage", null),
    new IpcContractError("rename_workspace", "success"),
    new Error("/private/path/token-value"),
    "/private/path/raw-rejection",
  ];

  for (const failure of failures) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeSetActiveWorkspace(
      previous,
      "workspace-1",
      async () => {
        throw failure;
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "internal" });
    assert.equal(outcome.state, previous);
    assert.equal(JSON.stringify(outcome).includes("/private/path"), false);
  }
});

test("active selection maps malformed success and error contracts to contract", async () => {
  for (const phase of ["success", "error"]) {
    const previous = readyState({
      workspaces: [workspace()],
    });
    const outcome = await executeSetActiveWorkspace(
      previous,
      "workspace-1",
      async () => {
        throw new IpcContractError("set_active_workspace", phase);
      },
    );

    assert.deepEqual(outcome.result, { ok: false, code: "contract" });
    assert.equal(outcome.state, previous);
  }
});

test("active selection preserves validated command failure notices without changing data", async () => {
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

  const outcome = await executeSetActiveWorkspace(
    previous,
    "workspace-1",
    async () => {
      throw commandError("storage", null, notices, "set_active_workspace");
    },
  );

  assert.deepEqual(outcome.result, { ok: false, code: "storage" });
  assert.equal(outcome.state.status, "ready");
  assert.equal(outcome.state.data, previous.data);
  assert.deepEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices, notices);
  assert.notEqual(outcome.state.notices[0], notices[0]);
});

test("active selection rejects stale canonical responses without changing state", async () => {
  const first = workspace();
  const second = workspace({
    id: "workspace-2",
    name: "Documentation",
    createdAt: "2026-06-15T12:00:00Z",
    updatedAt: "2026-06-15T12:00:00Z",
  });
  const previous = readyState({
    workspaces: [first, second],
    activeWorkspaceId: first.id,
  });
  const staleResponses = [
    {
      data: {
        ...previous.data,
        activeWorkspaceId: first.id,
      },
      notices: [],
    },
    {
      data: {
        ...previous.data,
        activeWorkspaceId: null,
      },
      notices: [],
    },
  ];

  for (const response of staleResponses) {
    const outcome = await executeSetActiveWorkspace(
      previous,
      second.id,
      async () => response,
    );

    assert.deepEqual(outcome.result, { ok: false, code: "internal" });
    assert.equal(outcome.state, previous);
  }
});

test("shared mutation queue serializes operations in submission order", async () => {
  const queue = createAppDataMutationQueue();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = queue.enqueue(async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
    return "first";
  });
  const second = queue.enqueue(async () => {
    events.push("second:start");
    events.push("second:end");
    return "second";
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();

  assert.equal(await first, "first");
  assert.equal(await second, "second");
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("shared mutation queue continues after an operation rejects", async () => {
  const queue = createAppDataMutationQueue();
  const events = [];

  const failure = queue.enqueue(async () => {
    events.push("failure");
    throw new Error("expected test failure");
  });
  const success = queue.enqueue(async () => {
    events.push("success");
    return "continued";
  });

  await assert.rejects(failure, /expected test failure/);
  assert.equal(await success, "continued");
  assert.deepEqual(events, ["failure", "success"]);
});

test("shared mutation queue serializes create, rename, and active selection work", async () => {
  const queue = createAppDataMutationQueue();
  const events = [];
  let releaseCreate;
  const createGate = new Promise((resolve) => {
    releaseCreate = resolve;
  });

  const create = queue.enqueue(async () => {
    events.push("create:start");
    await createGate;
    events.push("create:end");
    return "created";
  });
  const rename = queue.enqueue(async () => {
    events.push("rename:start");
    events.push("rename:end");
    return "renamed";
  });
  const active = queue.enqueue(async () => {
    events.push("active:start");
    events.push("active:end");
    return "active";
  });

  await Promise.resolve();
  assert.deepEqual(events, ["create:start"]);
  releaseCreate();

  assert.equal(await create, "created");
  assert.equal(await rename, "renamed");
  assert.equal(await active, "active");
  assert.deepEqual(events, [
    "create:start",
    "create:end",
    "rename:start",
    "rename:end",
    "active:start",
    "active:end",
  ]);
});
