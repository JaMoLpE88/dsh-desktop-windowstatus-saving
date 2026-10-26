import assert from "node:assert/strict";
import test from "node:test";

import { createMemory, observe, sameSnapshot } from "../lib/window-state.js";

const rect = { x: -2280, y: 43, width: 1938, height: 1318 };

test("a restored maximized window stays maximized while it is still hidden", () => {
  const memory = createMemory({ maximized: true });
  const snapshot = observe({ rect, visible: false, iconic: false, zoomed: false }, memory);
  assert.equal(snapshot.maximized, true);
  assert.equal(snapshot.maximizeNow, false);
  assert.equal(memory.seenVisible, false);
});

test("a visible normal window is maximized once when maximize was requested", () => {
  const memory = createMemory({ maximized: true });
  observe({ rect, visible: false, iconic: false, zoomed: false }, memory);
  const snapshot = observe({ rect, visible: true, iconic: false, zoomed: false }, memory);
  assert.equal(snapshot.maximizeNow, true);
  assert.equal(snapshot.maximized, true);
  assert.equal(memory.pendingMaximize, false);
  assert.equal(memory.seenVisible, true);
});

test("a window already maximized by the shell is not maximized twice", () => {
  const memory = createMemory({ maximized: true });
  const snapshot = observe({ rect, visible: true, iconic: false, zoomed: true }, memory);
  assert.equal(snapshot.maximizeNow, false);
  assert.equal(snapshot.maximized, true);
});

test("a visible normal window records its real state", () => {
  const memory = createMemory(null);
  const snapshot = observe({ rect, visible: true, iconic: false, zoomed: false }, memory);
  assert.equal(snapshot.maximized, false);
  assert.equal(memory.seenVisible, true);
});

test("minimizing keeps the previous maximized state", () => {
  const memory = createMemory({ maximized: true });
  observe({ rect, visible: true, iconic: false, zoomed: true }, memory);
  const snapshot = observe({ rect, visible: true, iconic: true, zoomed: false }, memory);
  assert.equal(snapshot.maximized, true);
});

test("hiding a normal window keeps it normal", () => {
  const memory = createMemory(null);
  observe({ rect, visible: true, iconic: false, zoomed: false }, memory);
  const snapshot = observe({ rect, visible: false, iconic: false, zoomed: false }, memory);
  assert.equal(snapshot.maximized, false);
});

test("snapshot comparison ignores transient fields", () => {
  assert.equal(
    sameSnapshot({ ...rect, maximized: false }, { ...rect, maximized: false, maximizeNow: true }),
    true,
  );
  assert.equal(sameSnapshot({ ...rect, maximized: false }, { ...rect, maximized: true }), false);
  assert.equal(sameSnapshot(null, { ...rect, maximized: false }), false);
});
