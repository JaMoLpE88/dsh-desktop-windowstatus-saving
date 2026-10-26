# Security

## What the plugin touches

- It reads Win32 window state through `user32.dll` / `kernel32.dll`: top-level
  window enumeration, the owning process, the window class, the normal
  placement and the monitor work area.
- It writes one state file, `$DSH_HOME/window-bounds.json`, with the window
  rectangle and the maximized flag.
- It applies a window placement only to the main DeepSeek Harness Desktop
  window: the top-level Chromium widget owned by the Electron process that
  launched the plugin host, with no owner window and a plausible size.

## Safety boundaries

- Window titles are never used to identify the target. A window from another
  process is never moved or resized.
- The target is re-checked before the placement is written, so a recycled
  window handle cannot redirect the write to another process.
- On any platform other than Windows, and outside the desktop shell, the
  plugin does nothing.

## Network and secrets

- No network requests of any kind.
- No telemetry, analytics or crash reporting.
- No credentials, cookies or session data are read or stored.

## Reporting a vulnerability

Please use a private security advisory on the GitHub repository rather than a
public issue. Include the affected version, the impact and the smallest
reproduction you can.
