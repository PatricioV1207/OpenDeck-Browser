import assert from "node:assert/strict";
import test from "node:test";

import {
  getActiveWorkspaceButtonLabel,
  getActiveWorkspaceButtonText,
  getActiveWorkspaceFailureMessage,
  getActiveWorkspaceSuccessMessage,
} from "../src/features/projects/workspaceActiveSelection.ts";

test("maps active workspace state to fixed visible button text", () => {
  assert.equal(getActiveWorkspaceButtonText(false), "Set active");
  assert.equal(getActiveWorkspaceButtonText(true), "Already active");
});

test("includes the workspace name in accessible active-selection labels", () => {
  assert.equal(
    getActiveWorkspaceButtonLabel("OpenDeck Browser", false),
    "Set OpenDeck Browser as the active workspace",
  );
  assert.equal(
    getActiveWorkspaceButtonLabel("OpenDeck Browser", true),
    "OpenDeck Browser is already the active workspace",
  );
});

test("maps active-selection outcomes to fixed success copy", () => {
  assert.equal(
    getActiveWorkspaceSuccessMessage("changed"),
    "Active workspace updated.",
  );
  assert.equal(
    getActiveWorkspaceSuccessMessage("unchanged"),
    "Workspace is already active.",
  );
});

test("maps every provider failure code to fixed active-selection copy", () => {
  const cases = [
    [
      "storage",
      "The active workspace could not be changed because local app data is unavailable.",
    ],
    [
      "unsupported_schema",
      "This app data requires a newer version of OpenDeck Browser before the active workspace can be changed.",
    ],
    [
      "contract",
      "The active workspace could not be changed because the native response could not be verified.",
    ],
    ["internal", "The active workspace could not be changed."],
  ];

  for (const [code, expectedMessage] of cases) {
    assert.equal(getActiveWorkspaceFailureMessage(code), expectedMessage);
  }
});
