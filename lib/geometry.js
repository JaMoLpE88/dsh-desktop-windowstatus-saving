/**
 * Pure geometry helpers: validation and fitting into a monitor work area.
 * No platform API and no I/O, so this module is unit-testable anywhere.
 */

/** Smallest window accepted as the desktop main window. */
export const MIN_WIDTH = 400;
export const MIN_HEIGHT = 300;

/** Upper bound that rejects corrupt or absurd state files. */
const LIMIT = 100_000;

/**
 * Whether a value is a usable window rectangle.
 * Negative positions are valid: monitors can sit left of or above the primary one.
 * @param {unknown} bounds candidate `{ x, y, width, height }`
 * @returns {boolean}
 */
export function isValidBounds(bounds) {
  if (bounds === null || typeof bounds !== "object" || Array.isArray(bounds)) return false;
  const { x, y, width, height } = bounds;
  if (![x, y, width, height].every((value) => Number.isFinite(value))) return false;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return false;
  if (width > LIMIT || height > LIMIT) return false;
  if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) return false;
  return true;
}

/** @param {{x:number,y:number,width:number,height:number}} bounds */
export function boundsToRect(bounds) {
  return {
    left: bounds.x,
    top: bounds.y,
    right: bounds.x + bounds.width,
    bottom: bounds.y + bounds.height,
  };
}

/** @param {{left:number,top:number,right:number,bottom:number}} rect */
export function rectToBounds(rect) {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  };
}

/**
 * Keep a saved window usable on the current display layout.
 * - An off-screen window moves to the work area's top-left corner.
 * - A window larger than the work area shrinks to fit.
 * - Anything else is returned unchanged, including negative coordinates.
 * @param {{x:number,y:number,width:number,height:number}} bounds saved geometry
 * @param {{left:number,top:number,right:number,bottom:number}} work target work area
 * @param {boolean} onScreen whether the saved rectangle still touches a monitor
 */
export function fitToWorkArea(bounds, work, onScreen) {
  const availableWidth = Math.max(1, work.right - work.left);
  const availableHeight = Math.max(1, work.bottom - work.top);
  const width = Math.min(bounds.width, availableWidth);
  const height = Math.min(bounds.height, availableHeight);
  if (!onScreen) return { x: work.left, y: work.top, width, height };
  return { x: bounds.x, y: bounds.y, width, height };
}
