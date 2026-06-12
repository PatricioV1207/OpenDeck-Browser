import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAppCommandErrorDto,
  parseAppDataResponseDto,
  parseAppInfoDto,
  toAppCommandError,
} from "../src/services/tauri/appDataGuards.ts";
import {
  AppCommandError,
  IpcContractError,
} from "../src/types/appData.ts";

const CREATED_AT = "2026-06-12T10:00:00Z";
const UPDATED_AT = "2026-06-12T11:00:00Z";

function validWorkspace(overrides = {}) {
  return {
    id: "workspace-1",
    name: "OpenDeck",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

function validResponse() {
  return {
    data: {
      schemaVersion: 1,
      settings: {
        colorMode: "system",
        sidebarCollapsed: false,
        statusPanelVisible: true,
      },
      workspaces: [validWorkspace()],
      activeWorkspaceId: "workspace-1",
    },
    notices: [],
  };
}

function assertContractError(
  callback,
  command = "load_app_data",
  phase = "success",
) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof IpcContractError);
    assert.equal(error.command, command);
    assert.equal(error.phase, phase);
    return true;
  });
}

test("parses strict app info DTOs", () => {
  assert.deepEqual(
    parseAppInfoDto({
      productName: "OpenDeck Browser",
      version: "0.1.0",
      supportedSchemaVersion: 1,
    }),
    {
      productName: "OpenDeck Browser",
      version: "0.1.0",
      supportedSchemaVersion: 1,
    },
  );

  assertContractError(
    () =>
      parseAppInfoDto({
        productName: "OpenDeck Browser",
        version: "0.1.0",
        supportedSchemaVersion: 1,
        unexpected: true,
      }),
    "get_app_info",
  );
});

test("parses a valid app-data response into fresh DTOs", () => {
  const source = validResponse();
  const parsed = parseAppDataResponseDto(source);

  assert.deepEqual(parsed, source);
  assert.notEqual(parsed, source);
  assert.notEqual(parsed.data, source.data);
  assert.notEqual(parsed.data.workspaces[0], source.data.workspaces[0]);
});

test("accepts every approved zero-offset RFC 3339 spelling", () => {
  for (const timestamp of [
    "2026-06-12T10:00:00Z",
    "2026-06-12T10:00:00+00:00",
    "2026-06-12T10:00:00-00:00",
    "2026-06-12T10:00:00.123456789Z",
  ]) {
    const response = validResponse();
    response.data.workspaces[0].createdAt = timestamp;
    response.data.workspaces[0].updatedAt = timestamp;

    assert.doesNotThrow(() => parseAppDataResponseDto(response));
  }
});

test("rejects unsupported schemas and internal sequence leakage", () => {
  const unsupported = validResponse();
  unsupported.data.schemaVersion = 2;
  assertContractError(() => parseAppDataResponseDto(unsupported));

  const leakedSequence = validResponse();
  leakedSequence.data.nextWorkspaceSequence = 2;
  assertContractError(() => parseAppDataResponseDto(leakedSequence));
});

test("rejects unknown, missing, and invalid settings fields", () => {
  const unknown = validResponse();
  unknown.data.settings.unexpected = true;
  assertContractError(() => parseAppDataResponseDto(unknown));

  const missing = validResponse();
  delete missing.data.settings.sidebarCollapsed;
  assertContractError(() => parseAppDataResponseDto(missing));

  const invalidMode = validResponse();
  invalidMode.data.settings.colorMode = "sepia";
  assertContractError(() => parseAppDataResponseDto(invalidMode));

  const invalidBoolean = validResponse();
  invalidBoolean.data.settings.statusPanelVisible = "true";
  assertContractError(() => parseAppDataResponseDto(invalidBoolean));
});

test("rejects more than 1,000 workspaces", () => {
  const response = validResponse();
  response.data.workspaces = Array.from({ length: 1_001 }, (_, index) =>
    validWorkspace({
      id: `workspace-${index + 1}`,
      name: `Workspace ${index + 1}`,
    }),
  );
  response.data.activeWorkspaceId = "workspace-1";

  assertContractError(() => parseAppDataResponseDto(response));
});

test("rejects noncanonical and out-of-range workspace IDs", () => {
  for (const id of [
    "workspace-0",
    "workspace-01",
    "workspace--1",
    "workspace-18446744073709551616",
    "project-1",
  ]) {
    const response = validResponse();
    response.data.workspaces[0].id = id;
    response.data.activeWorkspaceId = id;

    assertContractError(() => parseAppDataResponseDto(response));
  }
});

test("accepts the maximum canonical u64 workspace ID", () => {
  const response = validResponse();
  const id = "workspace-18446744073709551615";
  response.data.workspaces[0].id = id;
  response.data.activeWorkspaceId = id;

  assert.doesNotThrow(() => parseAppDataResponseDto(response));
});

test("rejects duplicate workspace IDs", () => {
  const response = validResponse();
  response.data.workspaces.push(
    validWorkspace({
      name: "Another",
    }),
  );

  assertContractError(() => parseAppDataResponseDto(response));
});

test("validates trimmed Unicode workspace names by character count", () => {
  const eightyEmoji = "😀".repeat(80);
  const valid = validResponse();
  valid.data.workspaces[0].name = eightyEmoji;
  assert.doesNotThrow(() => parseAppDataResponseDto(valid));

  for (const name of ["", " OpenDeck", "OpenDeck ", "a".repeat(81), "a\nb"]) {
    const response = validResponse();
    response.data.workspaces[0].name = name;
    assertContractError(() => parseAppDataResponseDto(response));
  }

  const tooManyEmoji = validResponse();
  tooManyEmoji.data.workspaces[0].name = "😀".repeat(81);
  assertContractError(() => parseAppDataResponseDto(tooManyEmoji));
});

test("rejects case-insensitive duplicate workspace names", () => {
  const response = validResponse();
  response.data.workspaces.push(
    validWorkspace({
      id: "workspace-2",
      name: "opendeck",
    }),
  );

  assertContractError(() => parseAppDataResponseDto(response));
});

test("rejects invalid, non-UTC, and descending timestamps", () => {
  for (const timestamp of [
    "2026-02-29T10:00:00Z",
    "2026-06-12T24:00:00Z",
    "2026-06-12T10:00:60Z",
    "2026-06-12T10:00:00.1234567890Z",
    "2026-06-12T10:00:00+01:00",
    "not-a-timestamp",
  ]) {
    const response = validResponse();
    response.data.workspaces[0].createdAt = timestamp;
    assertContractError(() => parseAppDataResponseDto(response));
  }

  const descending = validResponse();
  descending.data.workspaces[0].createdAt = UPDATED_AT;
  descending.data.workspaces[0].updatedAt = CREATED_AT;
  assertContractError(() => parseAppDataResponseDto(descending));

  const fractionalDescending = validResponse();
  fractionalDescending.data.workspaces[0].createdAt =
    "2026-06-12T10:00:00.000000002Z";
  fractionalDescending.data.workspaces[0].updatedAt =
    "2026-06-12T10:00:00.000000001Z";
  assertContractError(() => parseAppDataResponseDto(fractionalDescending));
});

test("requires activeWorkspaceId to reference an existing workspace", () => {
  const invalid = validResponse();
  invalid.data.activeWorkspaceId = "workspace-2";
  assertContractError(() => parseAppDataResponseDto(invalid));

  const cleared = validResponse();
  cleared.data.activeWorkspaceId = null;
  assert.doesNotThrow(() => parseAppDataResponseDto(cleared));
});

test("parses known notices and rejects malformed notice payloads", () => {
  const response = validResponse();
  response.notices.push({
    code: "corrupt_data_recovered",
    message: "Corrupt app data was recovered.",
  });
  assert.deepEqual(parseAppDataResponseDto(response).notices, response.notices);

  const unknownCode = validResponse();
  unknownCode.notices.push({
    code: "unknown_notice",
    message: "Unknown.",
  });
  assertContractError(() => parseAppDataResponseDto(unknownCode));

  const unknownField = validResponse();
  unknownField.notices.push({
    code: "corrupt_data_recovered",
    message: "Recovered.",
    details: "private",
  });
  assertContractError(() => parseAppDataResponseDto(unknownField));
});

test("parses every supported command-error shape", () => {
  const cases = [
    ["validation", "name"],
    ["validation", "patch"],
    ["not_found", "id"],
    ["conflict", "name"],
    ["storage", null],
    ["unsupported_schema", "schemaVersion"],
    ["internal", null],
  ];

  for (const [code, field] of cases) {
    assert.deepEqual(
      parseAppCommandErrorDto(
        {
          code,
          message: "Safe message.",
          field,
          notices: [],
        },
        "create_workspace",
      ),
      {
        code,
        message: "Safe message.",
        field,
        notices: [],
      },
    );
  }
});

test("rejects unknown error codes, fields, combinations, and keys", () => {
  for (const payload of [
    {
      code: "unknown",
      message: "Safe.",
      field: null,
      notices: [],
    },
    {
      code: "validation",
      message: "Safe.",
      field: "schemaVersion",
      notices: [],
    },
    {
      code: "storage",
      message: "Safe.",
      field: "id",
      notices: [],
    },
    {
      code: "internal",
      message: 42,
      field: null,
      notices: [],
    },
    {
      code: "internal",
      message: "Safe.",
      field: null,
      notices: [],
      rawPath: "/private/path",
    },
  ]) {
    assertContractError(
      () => parseAppCommandErrorDto(payload, "load_app_data"),
      "load_app_data",
      "error",
    );
  }
});

test("converts valid rejections into safe AppCommandError instances", () => {
  const error = toAppCommandError("create_workspace", {
    code: "validation",
    message: "The request contains invalid data.",
    field: "name",
    notices: [
      {
        code: "corrupt_data_recovered",
        message: "Corrupt app data was recovered.",
      },
    ],
  });

  assert.ok(error instanceof AppCommandError);
  assert.equal(error.command, "create_workspace");
  assert.equal(error.code, "validation");
  assert.equal(error.field, "name");
  assert.equal(error.message, "The request contains invalid data.");
  assert.deepEqual(error.notices, [
    {
      code: "corrupt_data_recovered",
      message: "Corrupt app data was recovered.",
    },
  ]);
  assert.equal("rawPayload" in error, false);
  assert.equal("cause" in error, false);
});

test("malformed rejections do not leak their raw values", () => {
  const secret = "/private/path/token-value";

  assert.throws(
    () =>
      toAppCommandError("load_app_data", {
        code: "storage",
        message: "Unsafe.",
        field: null,
        notices: [],
        secret,
      }),
    (error) => {
      assert.ok(error instanceof IpcContractError);
      assert.equal(error.command, "load_app_data");
      assert.equal(error.phase, "error");
      assert.equal(error.message.includes(secret), false);
      assert.equal("cause" in error, false);
      return true;
    },
  );
});
