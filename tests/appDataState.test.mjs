import assert from "node:assert/strict";
import test from "node:test";

import {
  createErrorAppDataState,
  createReadyAppDataState,
  createSingleFlightLoader,
  getAppDataStatusText,
  initialAppDataState,
} from "../src/state/appDataState.ts";
import {
  AppCommandError,
  IpcContractError,
} from "../src/types/appData.ts";

function appDataResponse(notices = []) {
  return {
    data: {
      schemaVersion: 1,
      settings: {
        colorMode: "system",
        sidebarCollapsed: false,
        statusPanelVisible: true,
      },
      workspaces: [],
      activeWorkspaceId: null,
    },
    notices,
  };
}

function commandError(code, field, notices = []) {
  return new AppCommandError("load_app_data", {
    code,
    message: "/private/path and native diagnostic details",
    field,
    notices,
  });
}

test("starts in a loading state without data, notices, or errors", () => {
  assert.deepEqual(initialAppDataState, {
    status: "loading",
    data: null,
    notices: [],
    error: null,
  });
  assert.deepEqual(getAppDataStatusText(initialAppDataState), {
    primary: "Loading local app data",
    notice: null,
  });
});

test("creates a ready state with the canonical snapshot and copied notices", () => {
  const response = appDataResponse([
    {
      code: "corrupt_data_recovered",
      message: "Arbitrary native notice text.",
    },
  ]);
  const state = createReadyAppDataState(response);

  assert.equal(state.status, "ready");
  assert.equal(state.data, response.data);
  assert.deepEqual(state.notices, response.notices);
  assert.notEqual(state.notices, response.notices);
  assert.notEqual(state.notices[0], response.notices[0]);
  assert.equal(state.error, null);
});

test("maps known command failures to fixed safe categories", () => {
  const unsupported = createErrorAppDataState(
    commandError("unsupported_schema", "schemaVersion"),
  );
  const storage = createErrorAppDataState(commandError("storage", null));
  const internal = createErrorAppDataState(commandError("internal", null));

  assert.deepEqual(unsupported.error, {
    code: "unsupported_schema",
    message: "This app data requires a newer version of OpenDeck Browser.",
  });
  assert.deepEqual(storage.error, {
    code: "storage",
    message: "Local app data could not be loaded safely.",
  });
  assert.deepEqual(internal.error, {
    code: "internal",
    message: "OpenDeck Browser could not load local app data.",
  });
});

test("maps malformed IPC responses to a fixed contract failure", () => {
  const state = createErrorAppDataState(
    new IpcContractError("load_app_data", "success"),
  );

  assert.deepEqual(state.error, {
    code: "contract",
    message: "OpenDeck Browser could not verify the native app data response.",
  });
});

test("maps unexpected failures without retaining rejected data", () => {
  const secret = "/private/path/token-value";
  const state = createErrorAppDataState(new Error(secret));

  assert.deepEqual(state, {
    status: "error",
    data: null,
    notices: [],
    error: {
      code: "internal",
      message: "OpenDeck Browser could not load local app data.",
    },
  });
  assert.equal(JSON.stringify(state).includes(secret), false);
});

test("retains validated recovery notices attached to command failures", () => {
  const notices = [
    {
      code: "corrupt_data_recovered",
      message: "Validated but not rendered directly.",
    },
  ];
  const state = createErrorAppDataState(
    commandError("storage", null, notices),
  );

  assert.deepEqual(state.notices, notices);
  assert.notEqual(state.notices, notices);
});

test("renders only fixed status text for recovery notices", () => {
  const state = createReadyAppDataState(
    appDataResponse([
      {
        code: "corrupt_data_recovered",
        message: "Do not render this arbitrary text.",
      },
    ]),
  );
  const status = getAppDataStatusText(state);

  assert.deepEqual(status, {
    primary: "Local app data ready",
    notice: "App data recovered with safe defaults.",
  });
  assert.equal(status.notice.includes("arbitrary"), false);
});

test("uses the safe error message as the status text", () => {
  const state = createErrorAppDataState(commandError("storage", null));

  assert.deepEqual(getAppDataStatusText(state), {
    primary: "Local app data could not be loaded safely.",
    notice: null,
  });
});

test("single-flight loading invokes the loader once per runtime", async () => {
  let calls = 0;
  const response = appDataResponse();
  const loadOnce = createSingleFlightLoader(async () => {
    calls += 1;
    return response;
  });

  const first = loadOnce();
  const second = loadOnce();
  const third = loadOnce();

  assert.equal(first, second);
  assert.equal(second, third);
  assert.deepEqual(await Promise.all([first, second, third]), [
    response,
    response,
    response,
  ]);
  assert.equal(calls, 1);
  assert.equal(loadOnce(), first);
});

test("single-flight loading also caches a rejected startup attempt", async () => {
  let calls = 0;
  const failure = commandError("storage", null);
  const loadOnce = createSingleFlightLoader(async () => {
    calls += 1;
    throw failure;
  });

  const first = loadOnce();
  const second = loadOnce();
  const results = await Promise.allSettled([first, second]);

  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "rejected");
  assert.equal(loadOnce(), first);
});
