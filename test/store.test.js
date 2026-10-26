import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { STATE_VERSION, loadState, saveState } from "../lib/store.js";

const directory = mkdtempSync(join(tmpdir(), "window-status-"));
after(() => rmSync(directory, { recursive: true, force: true }));

const bounds = { x: -2280, y: 43, width: 1938, height: 1318 };

test("round-trips a saved state and leaves no temporary file", () => {
  const file = join(directory, "roundtrip.json");

  saveState({ bounds, maximized: true }, file);
  const loaded = loadState(file);

  assert.equal(loaded.kind, "ok");
  assert.deepEqual(loaded.state, { bounds, maximized: true });
  assert.deepEqual(readdirSync(directory).filter((name) => name.startsWith("roundtrip")), ["roundtrip.json"]);

  const document = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(document.version, STATE_VERSION);
  assert.equal(typeof document.savedAt, "string");
});

test("keeps the restore diagnostic block when provided", () => {
  const file = join(directory, "restore.json");
  const restore = { at: "2026-10-26T00:00:00.000Z", whileHidden: true };
  saveState({ bounds, maximized: false, restore }, file);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")).restore, restore);
});

test("missing and corrupt files are reported without throwing", () => {
  assert.equal(loadState(join(directory, "absent.json")).kind, "missing");

  const file = join(directory, "corrupt.json");
  writeFileSync(file, "{ not json");
  assert.equal(loadState(file).kind, "invalid");

  writeFileSync(file, JSON.stringify({ version: 1, bounds: { x: 0, y: 0, width: 10, height: 10 } }));
  assert.equal(loadState(file).kind, "invalid");
});

test("a newer state file is left alone", () => {
  const file = join(directory, "newer.json");
  const newer = JSON.stringify({ version: 99, bounds, maximized: false });
  writeFileSync(file, newer);

  const loaded = loadState(file);
  assert.equal(loaded.kind, "version");
  assert.equal(loaded.version, 99);
  assert.equal(readFileSync(file, "utf8"), newer);
});

test("saving twice replaces the previous document", () => {
  const file = join(directory, "replace.json");
  saveState({ bounds, maximized: false }, file);
  saveState({ bounds: { ...bounds, width: 1200 }, maximized: true }, file);

  const loaded = loadState(file);
  assert.equal(loaded.kind, "ok");
  assert.equal(loaded.state.bounds.width, 1200);
  assert.equal(loaded.state.maximized, true);
  assert.deepEqual(readdirSync(directory).filter((name) => name.startsWith("replace")), ["replace.json"]);
});
