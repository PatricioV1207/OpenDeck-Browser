import assert from "node:assert/strict";
import test from "node:test";

import {
  getRenameWorkspaceFailureMessage,
  validateWorkspaceNameForRename,
} from "../src/features/projects/workspaceRenameForm.ts";

function workspace(name, id = "workspace-1") {
  return {
    id,
    name,
    createdAt: "2026-06-15T10:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
  };
}

test("trims a valid workspace rename before submission", () => {
  assert.deepEqual(
    validateWorkspaceNameForRename(
      "  OpenDeck Maintainers  ",
      "workspace-1",
      [workspace("OpenDeck Browser")],
    ),
    {
      ok: true,
      name: "OpenDeck Maintainers",
    },
  );
});

test("allows exact no-op and case-only renames", () => {
  const workspaces = [workspace("OpenDeck Browser")];

  assert.deepEqual(
    validateWorkspaceNameForRename(
      "  OpenDeck Browser  ",
      "workspace-1",
      workspaces,
    ),
    {
      ok: true,
      name: "OpenDeck Browser",
    },
  );
  assert.deepEqual(
    validateWorkspaceNameForRename(
      "opendeck browser",
      "workspace-1",
      workspaces,
    ),
    {
      ok: true,
      name: "opendeck browser",
    },
  );
});

test("accepts Unicode names using character rather than UTF-16 length", () => {
  const name = "🚀".repeat(80);

  assert.equal(name.length, 160);
  assert.deepEqual(
    validateWorkspaceNameForRename(name, "workspace-1", [
      workspace("Before"),
    ]),
    {
      ok: true,
      name,
    },
  );
});

test("rejects empty and whitespace-only names", () => {
  for (const value of ["", " ", "\t\n"]) {
    assert.deepEqual(
      validateWorkspaceNameForRename(value, "workspace-1", [
        workspace("Before"),
      ]),
      {
        ok: false,
        message: "Enter a workspace name.",
      },
    );
  }
});

test("rejects names longer than 80 Unicode characters", () => {
  assert.deepEqual(
    validateWorkspaceNameForRename("é".repeat(81), "workspace-1", [
      workspace("Before"),
    ]),
    {
      ok: false,
      message:
        "Workspace names must contain no more than 80 Unicode characters.",
    },
  );
});

test("rejects control characters without echoing the input", () => {
  const value = "Open\u0000Deck";
  const validation = validateWorkspaceNameForRename(
    value,
    "workspace-1",
    [workspace("Before")],
  );

  assert.deepEqual(validation, {
    ok: false,
    message: "Workspace names cannot contain control characters.",
  });
  assert.equal(JSON.stringify(validation).includes(value), false);
});

test("rejects duplicate names while excluding the renamed workspace", () => {
  const workspaces = [
    workspace("OpenDeck Browser"),
    workspace("Maintainer Tools", "workspace-2"),
  ];

  assert.deepEqual(
    validateWorkspaceNameForRename(
      "  maintainer tools ",
      "workspace-1",
      workspaces,
    ),
    {
      ok: false,
      message: "A workspace with this name already exists.",
    },
  );
});

test("maps every provider failure code to fixed Projects-owned copy", () => {
  const cases = [
    [
      "validation",
      "The workspace name was not accepted. Review the naming requirements and try again.",
    ],
    ["conflict", "A workspace with this name already exists."],
    [
      "storage",
      "The workspace could not be renamed because local app data is unavailable.",
    ],
    [
      "unsupported_schema",
      "This app data requires a newer version of OpenDeck Browser before a workspace can be renamed.",
    ],
    [
      "contract",
      "The workspace could not be renamed because the native response could not be verified.",
    ],
    ["internal", "The workspace could not be renamed."],
  ];

  for (const [code, expectedMessage] of cases) {
    assert.equal(getRenameWorkspaceFailureMessage(code), expectedMessage);
  }
});
