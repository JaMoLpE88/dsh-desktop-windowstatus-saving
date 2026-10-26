/**
 * Pure per-tick state machine.
 *
 * The persisted maximized flag must survive minimize and hide: while a window
 * is minimized `IsZoomed()` is false, yet the user still expects it back
 * maximized. `observe` therefore keeps the last visible truth and only trusts
 * the operating system while the window is visible and not minimized.
 */

/**
 * @param {{maximized:boolean}|null} saved persisted state, if any
 */
export function createMemory(saved) {
  return {
    maximized: saved?.maximized === true,
    pendingMaximize: saved?.maximized === true,
    seenVisible: false,
  };
}

/**
 * @param {{rect:object,visible:boolean,iconic:boolean,zoomed:boolean}} probe current window facts
 * @param {ReturnType<typeof createMemory>} memory state carried between ticks
 * @returns {{maximized:boolean,maximizeNow:boolean}&{x:number,y:number,width:number,height:number}}
 */
export function observe(probe, memory) {
  const { rect, visible, iconic, zoomed } = probe;
  let maximizeNow = false;

  if (!iconic && visible) {
    memory.seenVisible = true;
    if (memory.pendingMaximize) {
      maximizeNow = !zoomed;
      memory.maximized = true;
      memory.pendingMaximize = false;
    } else {
      memory.maximized = zoomed;
    }
  }

  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, maximized: memory.maximized, maximizeNow };
}

/** Compare two persisted snapshots, ignoring transient fields. */
export function sameSnapshot(left, right) {
  return left !== null && right !== null &&
    left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height &&
    left.maximized === right.maximized;
}
