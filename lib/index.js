import { createRequire } from "node:module";
import { join } from "node:path";

import { boundsToRect, fitToWorkArea, rectToBounds } from "./geometry.js";
import { createMemory, observe, sameSnapshot } from "./window-state.js";
import { loadState, saveState, stateFile } from "./store.js";
import {
  SW_SHOWMAXIMIZED,
  SW_SHOWNORMAL,
  bindUser32,
  findMainWindow,
  imagePath,
  isOnScreen,
  normalizeExePath,
  readPlacement,
  windowPid,
  workAreaFor,
  writePlacement,
} from "./win32.js";

export const inject = [];

/** Poll rate while the main window is expected to appear. */
const FAST_POLL_MS = 50;
/** Poll rate once the window is visible or has been hidden for a while. */
const STEADY_POLL_MS = 1_000;
/** How long to keep the fast poll after the plugin applies. */
const FAST_WINDOW_MS = 15_000;
/** Give up only when no desktop window can be found at all. */
const FIND_TIMEOUT_MS = 60_000;
const EFFECT_LABEL = "desktop window status saving";

/**
 * Load koffi. The declared dependency is tried first; the desktop runtime's
 * own copy is a deterministic fallback for a checkout installed without
 * dependencies.
 */
function loadKoffi() {
  try {
    return createRequire(import.meta.url)("koffi");
  } catch {}
  const runtimeDir = process.argv[2];
  if (typeof runtimeDir === "string" && runtimeDir.length > 0) {
    try {
      return createRequire(join(runtimeDir, "package.json"))("koffi");
    } catch {}
  }
  return null;
}

export function apply(ctx) {
  const warnings = new Set();
  const warnOnce = (key, message) => {
    if (warnings.has(key)) return;
    warnings.add(key);
    log("warn", message);
  };
  const log = (level, message) => {
    try {
      const logger = typeof ctx.logger === "function" ? ctx.logger("window-status") : ctx.logger;
      logger?.[level]?.(message);
    } catch {}
  };

  if (process.platform !== "win32") {
    log("info", `window status saving: Windows only, skipping ${process.platform}`);
    return;
  }
  if (process.versions.electron === undefined) {
    log("info", "window status saving: no desktop shell in this process, skipping");
    return;
  }

  const koffi = loadKoffi();
  if (koffi === null) {
    log("warn", "window status saving: koffi is unavailable, plugin disabled");
    return;
  }
  const binding = bindUser32(koffi);
  if (binding === null) {
    log("warn", "window status saving: failed to bind user32, plugin disabled");
    return;
  }

  const file = stateFile();
  const loaded = loadState(file);
  if (loaded.kind === "version") {
    log("warn", `window status saving: state file version ${String(loaded.version)} is newer, leaving it untouched`);
    return;
  }
  const saved = loaded.kind === "ok" ? loaded.state : null;

  ctx.effect(() => {
    const ownExe = normalizeExePath(process.execPath);
    const memory = createMemory(saved);
    const fastUntil = Date.now() + FAST_WINDOW_MS;
    const findDeadline = Date.now() + FIND_TIMEOUT_MS;

    let timer;
    let stopped = false;
    let target = null;
    let restored = false;
    let last = null;
    let restore;

    const persist = (snapshot) => {
      try {
        saveState({
          bounds: { x: snapshot.x, y: snapshot.y, width: snapshot.width, height: snapshot.height },
          maximized: snapshot.maximized === true,
          ...(restore === undefined ? {} : { restore }),
        }, file);
        last = { ...snapshot };
      } catch (error) {
        warnOnce("save", `window status saving: cannot save window state: ${String(error)}`);
      }
    };

    const belongsToHost = (hwnd) => {
      const pid = windowPid(binding, hwnd);
      if (pid === process.ppid) return true;
      return ownExe !== null && normalizeExePath(imagePath(binding, pid)) === ownExe;
    };

    const acquire = () => {
      if (target !== null && binding.IsWindow(target)) return target;
      target = findMainWindow(binding, process.ppid, ownExe);
      return target;
    };

    const applySaved = (hwnd) => {
      if (!belongsToHost(hwnd)) {
        warnOnce("owner", "window status saving: refusing to restore a window owned by another process");
        return null;
      }
      const rect = boundsToRect(saved.bounds);
      const work = workAreaFor(binding, rect);
      const fitted = fitToWorkArea(saved.bounds, work ?? rect, isOnScreen(binding, rect));
      if (!writePlacement(binding, hwnd, fitted, SW_SHOWNORMAL)) {
        warnOnce("place", "window status saving: SetWindowPlacement failed");
        return null;
      }
      if (saved.maximized) {
        // Move first, then maximize on the target monitor; both calls act on
        // the still hidden window, so the first painted frame is final.
        writePlacement(binding, hwnd, fitted, SW_SHOWMAXIMIZED);
      }
      return fitted;
    };

    const schedule = (delay) => {
      if (stopped) return;
      timer = setTimeout(tick, delay);
    };

    const tick = () => {
      timer = undefined;
      if (stopped) return;

      try {
        const hwnd = acquire();
        if (hwnd === null) {
          if (Date.now() > findDeadline) {
            warnOnce("find", "window status saving: no desktop window found, stopping");
            return;
          }
          schedule(FAST_POLL_MS);
          return;
        }

        const placement = readPlacement(binding, hwnd);
        if (placement === null) {
          target = null;
          schedule(FAST_POLL_MS);
          return;
        }

        const visible = binding.IsWindowVisible(hwnd);
        const iconic = binding.IsIconic(hwnd);

        if (!restored) {
          restored = true;
          const hidden = !visible && !iconic;
          if (saved !== null && hidden) {
            const fitted = applySaved(hwnd);
            if (fitted !== null) {
              restore = { at: new Date().toISOString(), whileHidden: true };
              memory.maximized = saved.maximized;
              memory.pendingMaximize = saved.maximized;
              persist({ ...fitted, maximized: saved.maximized });
              log(
                "info",
                `window status saving: restored ${fitted.width}x${fitted.height} at (${fitted.x},${fitted.y})` +
                (saved.maximized ? " maximized" : ""),
              );
            }
          } else if (saved === null) {
            log("info", "window status saving: no saved state yet, tracking the current window");
          } else {
            log("info", "window status saving: window already visible, keeping its current geometry");
          }
        }

        const snapshot = observe({
          rect: rectToBounds(placement.rect),
          visible,
          iconic,
          zoomed: binding.IsZoomed(hwnd),
        }, memory);

        if (snapshot.maximizeNow) {
          binding.ShowWindow(hwnd, SW_SHOWMAXIMIZED);
        }

        if (memory.seenVisible && !sameSnapshot(last, snapshot)) persist(snapshot);

        const fast = !memory.seenVisible && Date.now() < fastUntil;
        schedule(fast ? FAST_POLL_MS : STEADY_POLL_MS);
      } catch (error) {
        warnOnce("tick", `window status saving: window check failed: ${String(error)}`);
        schedule(STEADY_POLL_MS);
      }
    };

    tick();

    return () => {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      try {
        if (!memory.seenVisible) return;
        const hwnd = target !== null && binding.IsWindow(target)
          ? target
          : findMainWindow(binding, process.ppid, ownExe);
        if (hwnd === null) return;
        const placement = readPlacement(binding, hwnd);
        if (placement === null) return;
        if (binding.IsWindowVisible(hwnd) && !binding.IsIconic(hwnd)) {
          memory.maximized = binding.IsZoomed(hwnd);
        }
        const snapshot = { ...rectToBounds(placement.rect), maximized: memory.maximized };
        if (!sameSnapshot(last, snapshot)) {
          persist(snapshot);
          log("info", `window status saving: saved final ${snapshot.width}x${snapshot.height} at (${snapshot.x},${snapshot.y})`);
        }
      } catch (error) {
        log("warn", `window status saving: final save failed: ${String(error)}`);
      }
    };
  }, EFFECT_LABEL);
}
