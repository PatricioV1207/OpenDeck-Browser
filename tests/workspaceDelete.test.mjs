import assert from "node:assert/strict";
import test from "node:test";

import {
  DELETE_WORKSPACE_CONFIRMATION_COPY,
  DELETE_WORKSPACE_SUCCESS_MESSAGE,
  getCancelDeleteWorkspaceButtonLabel,
  getConfirmDeleteWorkspaceButtonLabel,
  getDeleteWorkspaceButtonLabel,
  getDeleteWorkspaceFailureMessage,
} from "../src/features/projects/workspaceDelete.ts";

test("includes the workspace name in delete button labels", () => {
  assert.equal(
    getDeleteWorkspaceButtonLabel("OpenDeck Browser"),
    "Delete OpenDeck Browser",
  );
  assert.equal(
    getConfirmDeleteWorkspaceButtonLabel("OpenDeck Browser"),
    "Delete workspace OpenDeck Browser",
  );
  assert.equal(
    getCancelDeleteWorkspaceButtonLabel("OpenDeck Browser"),
    "Cancel deleting OpenDeck Browser",
  );
});

test("uses fixed metadata-only confirmation copy", () => {
  assert.equal(
    DELETE_WORKSPACE_CONFIRMATION_COPY,
    "This removes only local workspace metadata. It does not delete repositories, folders, files, credentials, or remote data.",
  );
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("metadata"), true);
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("repositories"), true);
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("folders"), true);
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("files"), true);
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("credentials"), true);
  assert.equal(DELETE_WORKSPACE_CONFIRMATION_COPY.includes("remote data"), true);
});

test("uses fixed delete success copy", () => {
  assert.equal(DELETE_WORKSPACE_SUCCESS_MESSAGE, "Workspace deleted.");
});

test("maps every provider failure code to fixed delete copy", () => {
  const cases = [
    [
      "storage",
      "The workspace could not be deleted because local app data is unavailable.",
    ],
    [
      "unsupported_schema",
      "This app data requires a newer version of OpenDeck Browser before a workspace can be deleted.",
    ],
    [
      "contract",
      "The workspace could not be deleted because the native response could not be verified.",
    ],
    ["internal", "The workspace could not be deleted."],
  ];

  for (const [code, expectedMessage] of cases) {
    assert.equal(getDeleteWorkspaceFailureMessage(code), expectedMessage);
  }
});
