import assert from "node:assert/strict";
import test from "node:test";

import koffi from "koffi";

import { bindUser32, className, enumTopLevel, readPlacement } from "../lib/win32.js";

const onWindows = process.platform === "win32";

test("binds user32 with the expected native layout", { skip: !onWindows }, () => {
  const binding = bindUser32(koffi);
  assert.ok(binding);
  assert.equal(koffi.sizeof("DshWinStatusPlacement"), 44);
  assert.equal(koffi.sizeof("DshWinStatusMonitorInfo"), 40);
});

test("enumerates top-level windows and reads their placement", { skip: !onWindows }, () => {
  const binding = bindUser32(koffi);
  assert.ok(binding);

  let first = null;
  let count = 0;
  enumTopLevel(binding, (hwnd) => {
    count += 1;
    if (first === null && className(binding, hwnd).length > 0) first = hwnd;
    return true;
  });

  assert.ok(count > 0, "EnumWindows returned no windows");
  assert.ok(first !== null, "no named top-level window found");

  const placement = readPlacement(binding, first);
  assert.ok(placement);
  assert.ok(placement.rect.right >= placement.rect.left);
  assert.ok(placement.rect.bottom >= placement.rect.top);
});
