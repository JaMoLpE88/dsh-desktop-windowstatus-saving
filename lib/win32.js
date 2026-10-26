import { MIN_HEIGHT, MIN_WIDTH } from "./geometry.js";

/**
 * Minimal user32/kernel32 bindings used to read and restore one window.
 *
 * Two conventions keep repeated plugin loads safe:
 * - the binding is cached on the koffi object (a module-level cache would be
 *   reset by HMR while koffi keeps its process-wide type registry),
 * - every koffi type name carries this plugin's prefix, so the host or another
 *   plugin can register common names such as RECT without a collision.
 */

const BINDING_KEY = Symbol.for("@jamolpe88/dsh-desktop-windowstatus-saving/user32");

const TYPES = Object.freeze({
  point: "DshWinStatusPoint",
  rect: "DshWinStatusRect",
  monitor: "DshWinStatusMonitorInfo",
  placement: "DshWinStatusPlacement",
  enumProc: "DshWinStatusEnumProc",
});

/** WINDOWPLACEMENT length on both 32-bit and 64-bit Windows. */
const PLACEMENT_LENGTH = 44;
const MONITORINFO_LENGTH = 40;

const GW_OWNER = 4;
const MONITOR_DEFAULTTONULL = 0;
const MONITOR_DEFAULTTONEAREST = 2;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

export const SW_SHOWNORMAL = 1;
export const SW_SHOWMAXIMIZED = 3;

function emptyPlacement() {
  return {
    length: PLACEMENT_LENGTH,
    flags: 0,
    showCmd: 0,
    ptMinPosition: { x: 0, y: 0 },
    ptMaxPosition: { x: 0, y: 0 },
    rcNormalPosition: { left: 0, top: 0, right: 0, bottom: 0 },
  };
}

/**
 * Bind user32 once per koffi instance.
 * @param {object} koffi loaded koffi module
 * @returns {object|null} binding, or null when the platform rejects it
 */
export function bindUser32(koffi) {
  if (koffi[BINDING_KEY] !== undefined) return koffi[BINDING_KEY];
  if (typeof koffi?.load !== "function") return null;

  try {
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");

    koffi.struct(TYPES.point, { x: "int32", y: "int32" });
    koffi.struct(TYPES.rect, { left: "int32", top: "int32", right: "int32", bottom: "int32" });
    koffi.struct(TYPES.monitor, {
      cbSize: "uint32",
      rcMonitor: TYPES.rect,
      rcWork: TYPES.rect,
      dwFlags: "uint32",
    });
    koffi.struct(TYPES.placement, {
      length: "uint32",
      flags: "uint32",
      showCmd: "uint32",
      ptMinPosition: TYPES.point,
      ptMaxPosition: TYPES.point,
      rcNormalPosition: TYPES.rect,
    });

    const binding = {
      koffi,
      placementLength: PLACEMENT_LENGTH,

      GetWindowPlacement: user32.func(`bool GetWindowPlacement(void *hwnd, _Inout_ ${TYPES.placement} *placement)`),
      SetWindowPlacement: user32.func(`bool SetWindowPlacement(void *hwnd, _Inout_ ${TYPES.placement} *placement)`),
      GetWindow: user32.func("void *GetWindow(void *hwnd, uint32 command)"),
      IsWindow: user32.func("bool IsWindow(void *hwnd)"),
      IsWindowVisible: user32.func("bool IsWindowVisible(void *hwnd)"),
      IsIconic: user32.func("bool IsIconic(void *hwnd)"),
      IsZoomed: user32.func("bool IsZoomed(void *hwnd)"),
      ShowWindow: user32.func("bool ShowWindow(void *hwnd, int command)"),
      GetClassNameW: user32.func("int GetClassNameW(void *hwnd, _Out_ uint16 *buffer, int size)"),
      GetWindowThreadProcessId: user32.func("uint32 GetWindowThreadProcessId(void *hwnd, _Out_ uint32 *pid)"),
      EnumWindows: user32.func("bool EnumWindows(void *callback, intptr parameter)"),
      MonitorFromRect: user32.func(`void *MonitorFromRect(_In_ ${TYPES.rect} *rect, uint32 flags)`),
      GetMonitorInfoW: user32.func(`bool GetMonitorInfoW(void *monitor, _Inout_ ${TYPES.monitor} *info)`),

      enumProc: koffi.proto(`bool __stdcall ${TYPES.enumProc}(void *hwnd, intptr parameter)`),

      OpenProcess: kernel32.func("void *OpenProcess(uint32 access, bool inherit, uint32 pid)"),
      QueryFullProcessImageNameW: kernel32.func(
        "bool QueryFullProcessImageNameW(void *process, uint32 flags, _Out_ uint16 *buffer, _Inout_ uint32 *size)",
      ),
      CloseHandle: kernel32.func("bool CloseHandle(void *handle)"),
    };

    Object.defineProperty(koffi, BINDING_KEY, { value: binding, configurable: true });
    return binding;
  } catch {
    return null;
  }
}

function decode(buffer) {
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    .toString("utf16le")
    .replace(/\0.*$/u, "");
}

/** Window class name, or an empty string when it cannot be read. */
export function className(binding, hwnd) {
  const buffer = new Uint16Array(256);
  const length = binding.GetClassNameW(hwnd, buffer, buffer.length);
  return length <= 0 ? "" : decode(buffer);
}

/** Process owning a window; 0 when the window is invalid. */
export function windowPid(binding, hwnd) {
  const pid = [0];
  binding.GetWindowThreadProcessId(hwnd, pid);
  return pid[0];
}

/** Full executable path of a process, or null. */
export function imagePath(binding, pid) {
  const handle = binding.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (handle === null) return null;
  try {
    const buffer = new Uint16Array(32_768);
    const size = [buffer.length];
    return binding.QueryFullProcessImageNameW(handle, 0, buffer, size) ? decode(buffer) : null;
  } finally {
    binding.CloseHandle(handle);
  }
}

/** Case- and separator-insensitive path used to compare executables. */
export function normalizeExePath(path) {
  if (typeof path !== "string" || path.length === 0) return null;
  return path.replace(/\//g, "\\").replace(/^\\\\\?\\/u, "").toLowerCase();
}

/**
 * Read the geometry of a window in its normal (restored) state.
 * `rcNormalPosition` is the only rectangle that stays meaningful while the
 * window is maximized or minimized.
 * @returns {{showCmd:number,rect:object}|null}
 */
export function readPlacement(binding, hwnd) {
  const placement = emptyPlacement();
  if (!binding.GetWindowPlacement(hwnd, placement)) return null;
  const rect = placement.rcNormalPosition;
  return {
    showCmd: placement.showCmd,
    rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
  };
}

/**
 * Apply a normal-state rectangle and a show command without showing the window.
 * The minimized/maximized positions are kept from the current placement
 * instead of being invented.
 * @param {object} bounds `{ x, y, width, height }`
 * @param {number} showCmd `SW_SHOWNORMAL` or `SW_SHOWMAXIMIZED`
 */
export function writePlacement(binding, hwnd, bounds, showCmd) {
  const placement = emptyPlacement();
  const current = emptyPlacement();
  if (binding.GetWindowPlacement(hwnd, current)) {
    placement.flags = current.flags;
    placement.ptMinPosition = { x: current.ptMinPosition.x, y: current.ptMinPosition.y };
    placement.ptMaxPosition = { x: current.ptMaxPosition.x, y: current.ptMaxPosition.y };
  }
  placement.showCmd = showCmd;
  placement.rcNormalPosition = {
    left: bounds.x,
    top: bounds.y,
    right: bounds.x + bounds.width,
    bottom: bounds.y + bounds.height,
  };
  return binding.SetWindowPlacement(hwnd, placement) === true;
}

/** Enumerate top-level windows; returning false from the visitor stops early. */
export function enumTopLevel(binding, visitor) {
  const callback = binding.koffi.register((hwnd) => {
    try {
      return visitor(hwnd) !== false;
    } catch {
      return true;
    }
  }, binding.koffi.pointer(binding.enumProc));
  try {
    binding.EnumWindows(callback, 0);
  } finally {
    binding.koffi.unregister(callback);
  }
}

/** Whether a rectangle still touches any monitor. */
export function isOnScreen(binding, rect) {
  return binding.MonitorFromRect(rect, MONITOR_DEFAULTTONULL) !== null;
}

/** Work area (taskbar excluded) of the monitor nearest to a rectangle. */
export function workAreaFor(binding, rect) {
  const monitor = binding.MonitorFromRect(rect, MONITOR_DEFAULTTONEAREST);
  if (monitor === null) return null;
  const info = {
    cbSize: MONITORINFO_LENGTH,
    rcMonitor: { left: 0, top: 0, right: 0, bottom: 0 },
    rcWork: { left: 0, top: 0, right: 0, bottom: 0 },
    dwFlags: 0,
  };
  if (!binding.GetMonitorInfoW(monitor, info)) return null;
  return {
    left: info.rcWork.left,
    top: info.rcWork.top,
    right: info.rcWork.right,
    bottom: info.rcWork.bottom,
  };
}

/**
 * Find the desktop main window.
 *
 * The window belongs to the Electron parent process, is a top-level Chromium
 * widget, has no owner (owned windows are dialogs and overlays) and is large
 * enough to be the product window. Titles are never used: they are arbitrary
 * text and would let another application's window qualify.
 *
 * @param {object} binding user32 binding
 * @param {number} parentPid host parent, i.e. the Electron main process
 * @param {string|null} ownExe normalized executable of this process
 * @returns {object|null} native window handle
 */
export function findMainWindow(binding, parentPid, ownExe) {
  const candidates = [];
  enumTopLevel(binding, (hwnd) => {
    if (binding.GetWindow(hwnd, GW_OWNER) !== null) return true;
    const name = className(binding, hwnd);
    if (!name.startsWith("Chrome_WidgetWin")) return true;
    const placement = readPlacement(binding, hwnd);
    if (placement === null) return true;
    const width = placement.rect.right - placement.rect.left;
    const height = placement.rect.bottom - placement.rect.top;
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return true;
    candidates.push({
      hwnd,
      pid: windowPid(binding, hwnd),
      area: width * height,
      visible: binding.IsWindowVisible(hwnd),
      // Electron creates the product window as Chrome_WidgetWin_1; Chromium
      // also keeps hidden top-level helper widgets (Chrome_WidgetWin_0) that
      // can be large, so the class decides before size does.
      product: name === "Chrome_WidgetWin_1",
    });
    return true;
  });

  if (candidates.length === 0) return null;

  let owned = candidates.filter((candidate) => candidate.pid === parentPid);
  if (owned.length === 0 && ownExe !== null) {
    owned = candidates.filter((candidate) => normalizeExePath(imagePath(binding, candidate.pid)) === ownExe);
  }
  if (owned.length === 0) return null;

  owned.sort((left, right) =>
    Number(right.product) - Number(left.product) ||
    right.area - left.area ||
    Number(right.visible) - Number(left.visible));
  return owned[0].hwnd;
}
