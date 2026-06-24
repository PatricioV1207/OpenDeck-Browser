import assert from "node:assert/strict";
import test from "node:test";

import {
  createSettingsDraft,
  createSettingsPatch,
  getUpdateSettingsFailureMessage,
  getUpdateSettingsSuccessMessage,
} from "../src/features/settings/settingsFormHelpers.ts";

const canonicalSettings = {
  colorMode: "system",
  sidebarCollapsed: false,
  statusPanelVisible: true,
};

test("creates an independent draft from canonical settings", () => {
  const draft = createSettingsDraft(canonicalSettings);

  assert.deepEqual(draft, canonicalSettings);
  assert.notEqual(draft, canonicalSettings);
});

test("returns no patch when the draft is unchanged", () => {
  assert.equal(
    createSettingsPatch(canonicalSettings, { ...canonicalSettings }),
    null,
  );
});

test("builds a minimal patch for each supported setting", () => {
  assert.deepEqual(
    createSettingsPatch(canonicalSettings, {
      ...canonicalSettings,
      colorMode: "dark",
    }),
    { colorMode: "dark" },
  );
  assert.deepEqual(
    createSettingsPatch(canonicalSettings, {
      ...canonicalSettings,
      sidebarCollapsed: true,
    }),
    { sidebarCollapsed: true },
  );
  assert.deepEqual(
    createSettingsPatch(canonicalSettings, {
      ...canonicalSettings,
      statusPanelVisible: false,
    }),
    { statusPanelVisible: false },
  );
});

test("builds one minimal patch for multiple changed settings", () => {
  assert.deepEqual(
    createSettingsPatch(canonicalSettings, {
      colorMode: "light",
      sidebarCollapsed: true,
      statusPanelVisible: false,
    }),
    {
      colorMode: "light",
      sidebarCollapsed: true,
      statusPanelVisible: false,
    },
  );
});

test("maps every provider failure code to fixed Settings-owned copy", () => {
  const expected = {
    validation:
      "Settings were not saved because the selected values are invalid.",
    storage: "Settings could not be saved safely.",
    unsupported_schema:
      "Settings cannot be saved because this app data requires a newer version of OpenDeck Browser.",
    contract:
      "Settings were not saved because the native response could not be verified.",
    internal: "Settings could not be saved.",
  };

  for (const [code, message] of Object.entries(expected)) {
    assert.equal(getUpdateSettingsFailureMessage(code), message);
    assert.equal(message.includes("/private/path"), false);
    assert.equal(message.includes("payload"), false);
  }
});

test("maps update outcomes to fixed deferred-application copy", () => {
  assert.equal(
    getUpdateSettingsSuccessMessage("updated"),
    "Settings saved. Interface application remains deferred.",
  );
  assert.equal(
    getUpdateSettingsSuccessMessage("unchanged"),
    "Settings are already up to date. Interface application remains deferred.",
  );
});
