import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_HEIGHT,
  MIN_WIDTH,
  boundsToRect,
  fitToWorkArea,
  isValidBounds,
  rectToBounds,
} from "../lib/geometry.js";

const work = { left: -2560, top: 0, right: 0, bottom: 1392 };

test("accepts a negative position for a monitor left of the primary one", () => {
  assert.equal(isValidBounds({ x: -2280, y: 43, width: 1938, height: 1318 }), true);
});

test("rejects malformed or implausible geometry", () => {
  assert.equal(isValidBounds(null), false);
  assert.equal(isValidBounds([]), false);
  assert.equal(isValidBounds({ x: 0, y: 0, width: MIN_WIDTH - 1, height: MIN_HEIGHT }), false);
  assert.equal(isValidBounds({ x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT - 1 }), false);
  assert.equal(isValidBounds({ x: 0, y: 0, width: Number.NaN, height: 600 }), false);
  assert.equal(isValidBounds({ x: 0, y: 0, width: "1938", height: 1318 }), false);
  assert.equal(isValidBounds({ x: 200_000, y: 0, width: 1000, height: 800 }), false);
  assert.equal(isValidBounds({ x: 0, y: 0, width: 100_000, height: 100_000 }), true);
});

test("keeps an on-screen window untouched when it fits", () => {
  const bounds = { x: -2280, y: 43, width: 1938, height: 1318 };
  assert.deepEqual(fitToWorkArea(bounds, work, true), bounds);
});

test("shrinks a window that is larger than the target work area", () => {
  const fitted = fitToWorkArea({ x: -2500, y: 0, width: 3000, height: 2000 }, work, true);
  assert.deepEqual(fitted, { x: -2500, y: 0, width: 2560, height: 1392 });
});

test("moves an off-screen window into the nearest work area", () => {
  const fitted = fitToWorkArea({ x: 9000, y: 9000, width: 1200, height: 800 }, work, false);
  assert.deepEqual(fitted, { x: -2560, y: 0, width: 1200, height: 800 });
});

test("round-trips between bounds and a native rectangle", () => {
  const bounds = { x: -2280, y: 43, width: 1938, height: 1318 };
  assert.deepEqual(rectToBounds(boundsToRect(bounds)), bounds);
});
