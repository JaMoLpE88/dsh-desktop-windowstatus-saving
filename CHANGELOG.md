# Changelog

## 0.1.0 — 2026-10-26

First release.

- Remembers the DeepSeek Harness Desktop main window size, position and
  maximized state.
- Restores the placement while the window is still hidden, so the first
  visible frame is the saved one.
- Keeps the maximized flag through minimize and tray hide.
- Restores onto the saved display, including negative coordinates, and fits
  the window into the nearest work area when a display disappears.
- Atomic state writes; a corrupt state file or one written by a newer version
  is handled safely.
- Windows only; no configuration, no network, no extra process.
