import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isValidBounds } from "./geometry.js";

/** File format version written by this plugin. */
export const STATE_VERSION = 1;

/**
 * @returns {string} the state file, shared by every profile of this DSH home
 */
export function stateFile() {
  const home = process.env.DSH_HOME || join(homedir(), ".dsh");
  return join(home, "window-bounds.json");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the persisted window state.
 *
 * `version` means the file belongs to a newer plugin layout: the caller must
 * neither restore it nor overwrite it.
 * @param {string} [file]
 * @returns {{kind:"ok",state:{bounds:object,maximized:boolean}}|{kind:"missing"}|{kind:"invalid"}|{kind:"version",version:unknown}}
 */
export function loadState(file = stateFile()) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return error?.code === "ENOENT" ? { kind: "missing" } : { kind: "invalid" };
  }

  try {
    const value = JSON.parse(text);
    if (!isRecord(value)) return { kind: "invalid" };
    if (value.version !== STATE_VERSION) return { kind: "version", version: value.version };
    if (!isValidBounds(value.bounds)) return { kind: "invalid" };
    return {
      kind: "ok",
      state: {
        bounds: {
          x: value.bounds.x,
          y: value.bounds.y,
          width: value.bounds.width,
          height: value.bounds.height,
        },
        maximized: value.maximized === true,
      },
    };
  } catch {
    return { kind: "invalid" };
  }
}

/**
 * Write the state atomically: a sibling temporary file is renamed over the
 * target, so a crash mid-write cannot leave a truncated JSON document.
 * @param {{bounds:object,maximized:boolean,restore?:object}} state
 * @param {string} [file]
 */
export function saveState(state, file = stateFile()) {
  const body = JSON.stringify({
    version: STATE_VERSION,
    bounds: state.bounds,
    maximized: state.maximized === true,
    savedAt: new Date().toISOString(),
    ...(state.restore === undefined ? {} : { restore: state.restore }),
  }, null, 2) + "\n";

  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, body);
  try {
    renameSync(temporary, file);
  } catch (error) {
    try { rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}
