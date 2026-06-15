import assert from "node:assert/strict";
import test from "node:test";

import {
  getCreateWorkspaceFailureMessage,
  validateWorkspaceNameForCreate,
} from "../src/features/projects/workspaceCreateForm.ts";

function workspace(name, id = "workspace-1") {
  return {
    id,
    name,
    createdAt: "2026-06-15T10:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
  };
}

test("trims a valid workspace name before submission", () => {
  assert.deepEqual(
    validateWorkspaceNameForCreate("  OpenDeck Browser  ", []),
    {
      ok: true,
      name: "OpenDeck Browser",
    },
  );
});

test("accepts Unicode names using character rather than UTF-16 length", () => {
  const name = "🚀".repeat(80);

  assert.equal(name.length, 160);
  assert.deepEqual(validateWorkspaceNameForCreate(name, []), {
    ok: true,
    name,
  });
});

test("rejects empty and whitespace-only names", () => {
  for (const value of ["", " ", "\t\n"]) {
    assert.deepEqual(validateWorkspaceNameForCreate(value, []), {
      ok: false,
      message: "Enter a workspace name.",
    });
  }
});

test("rejects names longer than 80 Unicode characters", () => {
  assert.deepEqual(
    validateWorkspaceNameForCreate("é".repeat(81), []),
    {
      ok: false,
      message:
        "Workspace names must contain no more than 80 Unicode characters.",
    },
  );
});

test("rejects embedded control characters without echoing the input", () => {
  const value = "Open\u0000Deck";
  const validation = validateWorkspaceNameForCreate(value, []);

  assert.deepEqual(validation, {
    ok: false,
    message: "Workspace names cannot contain control characters.",
  });
  assert.equal(JSON.stringify(validation).includes(value), false);
});

test("rejects duplicate names ignoring case after trimming", () => {
  const workspaces = [workspace("OpenDeck Browser")];

  assert.deepEqual(
    validateWorkspaceNameForCreate("  opendeck browser ", workspaces),
    {
      ok: false,
      message: "A workspace with this name already exists.",
    },
  );
});

test("rejects creation at the 1,000-workspace limit", () => {
  const workspaces = Array.from({ length: 1_000 }, (_, index) =>
    workspace(`Workspace ${index + 1}`, `workspace-${index + 1}`),
  );

  assert.deepEqual(
    validateWorkspaceNameForCreate("Another workspace", workspaces),
    {
      ok: false,
      message: "OpenDeck Browser supports up to 1,000 workspaces.",
    },
  );
});

test("maps every provider failure code to fixed Projects-owned copy", () => {
  const cases = [
    [
      "validation",
      "The workspace name was not accepted. Review the naming requirements and try again.",
    ],
    [
      "conflict",
      "A workspace with this name already exists, or the workspace limit has been reached.",
    ],
    [
      "storage",
      "The workspace could not be saved because local app data is unavailable.",
    ],
    [
      "unsupported_schema",
      "This app data requires a newer version of OpenDeck Browser before a workspace can be created.",
    ],
    [
      "contract",
      "The workspace could not be created because the native response could not be verified.",
    ],
    ["internal", "The workspace could not be created."],
  ];

  for (const [code, expectedMessage] of cases) {
    assert.equal(getCreateWorkspaceFailureMessage(code), expectedMessage);
  }
});
