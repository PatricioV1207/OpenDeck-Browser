import assert from "node:assert/strict";
import test from "node:test";
import {
  initialTabState,
  tabReducer,
} from "../src/features/tabs/tabReducer.ts";

function assertValidState(state) {
  assert.equal(state.openTabIds[0], "home");
  assert.equal(new Set(state.openTabIds).size, state.openTabIds.length);
  assert.ok(state.openTabIds.includes(state.activeTabId));
}

test("starts with pinned Home open and active", () => {
  assert.deepEqual(initialTabState, {
    openTabIds: ["home"],
    activeTabId: "home",
  });
  assertValidState(initialTabState);
});

test("appends and activates newly opened tabs", () => {
  const state = tabReducer(initialTabState, {
    type: "OPEN_TAB",
    tabId: "projects",
  });

  assert.deepEqual(state, {
    openTabIds: ["home", "projects"],
    activeTabId: "projects",
  });
  assertValidState(state);
});

test("focuses an existing tab without duplicating or reordering it", () => {
  const openState = {
    openTabIds: ["home", "settings", "projects"],
    activeTabId: "projects",
  };
  const state = tabReducer(openState, {
    type: "OPEN_TAB",
    tabId: "settings",
  });

  assert.deepEqual(state, {
    openTabIds: ["home", "settings", "projects"],
    activeTabId: "settings",
  });
  assertValidState(state);
});

test("ignores activation for a closed tab", () => {
  const state = tabReducer(initialTabState, {
    type: "ACTIVATE_TAB",
    tabId: "about",
  });

  assert.equal(state, initialTabState);
  assertValidState(state);
});

test("prevents Home from closing", () => {
  const state = tabReducer(initialTabState, {
    type: "CLOSE_TAB",
    tabId: "home",
  });

  assert.equal(state, initialTabState);
  assertValidState(state);
});

test("closes an inactive tab without changing the active tab", () => {
  const openState = {
    openTabIds: ["home", "projects", "settings"],
    activeTabId: "settings",
  };
  const state = tabReducer(openState, {
    type: "CLOSE_TAB",
    tabId: "projects",
  });

  assert.deepEqual(state, {
    openTabIds: ["home", "settings"],
    activeTabId: "settings",
  });
  assertValidState(state);
});

test("selects the right neighbor when closing an active middle tab", () => {
  const openState = {
    openTabIds: ["home", "projects", "settings", "about"],
    activeTabId: "projects",
  };
  const state = tabReducer(openState, {
    type: "CLOSE_TAB",
    tabId: "projects",
  });

  assert.deepEqual(state, {
    openTabIds: ["home", "settings", "about"],
    activeTabId: "settings",
  });
  assertValidState(state);
});

test("selects the left neighbor when closing the final active tab", () => {
  const openState = {
    openTabIds: ["home", "projects", "about"],
    activeTabId: "about",
  };
  const state = tabReducer(openState, {
    type: "CLOSE_TAB",
    tabId: "about",
  });

  assert.deepEqual(state, {
    openTabIds: ["home", "projects"],
    activeTabId: "projects",
  });
  assertValidState(state);
});

test("falls back to Home when the only closable active tab closes", () => {
  const openState = {
    openTabIds: ["home", "about"],
    activeTabId: "about",
  };
  const state = tabReducer(openState, {
    type: "CLOSE_TAB",
    tabId: "about",
  });

  assert.deepEqual(state, initialTabState);
  assertValidState(state);
});
