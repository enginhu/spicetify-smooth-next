# Changelog

## 1.3.1 — 2026-11-09

- Standardize documentation, installer output, notifications, and menu labels on English.
- Remove the Turkish guides, add an English macOS companion guide, and update documentation links and ZIP contents.
- Prepare Marketplace distribution of the main extension and document the separate macOS companion installation.

## 1.3.0 — 2026-11-09

- Add an opt-in GMMK3 (100%, USB `342d:e3d1`) Mac-mode Fn+F5/Fn+F6 media profile.
- Route Fn+F5 to previous track and Fn+F6 to the existing fade-out; retain native media behavior when Spotify is disconnected or fade is disabled.
- Preserve plain F5/F6, unrelated keyboards, and existing SDCX knob support.
- Add native profile controls and eight regression checks (18 native checks, 34 JavaScript tests).
- Wait for the old LaunchAgent to exit before reinstalling, avoiding intermittent bootstrap error 5.

## 1.2.1 — 2026-11-09

- Refresh HID clients when enumerating devices, so USB reconnects do not leave stale services that reject all mapping writes.
- Use native WebSocket ping/pong instead of requiring a JavaScript heartbeat every three seconds; retain knob routing when Spotify's background timers are throttled.
- Reapply mappings reset to the saved baseline after wake; preserve different mappings made by other tools.
- Prune disconnected device records and add timestamps and rate limits to mapping error logs.
- Add 10 native regression checks alongside the 34 JavaScript tests.

## 1.2.0 — 2026-11-06

- Add an optional per-user macOS companion for the SDCX SIDE-KEYBOARD `0816:2474` Next knob.
- Redirect only that device's native Next through a reserved F20 hotkey and an origin-checked loopback WebSocket to the existing fade.
- Restore native mappings on disable, disconnect, or helper shutdown; reconnect after Spotify restarts or the keypad is reattached.
- Include source, the Apple Silicon helper, installation/removal scripts, and three bridge regression tests (34 tests total).
- Physically verify the knob with Spotify in the background and verify keymap restoration on helper exit.

## 1.1.0 — 2026-11-06

- Add Cmd/Ctrl + Right Arrow and DOM MediaTrackNext support.
- Intercept generic next-track commands through Spotify's shared PlayerAPI, including its Media Session nexttrack callback.
- Preserve explicit queue selections, original method arguments and receiver, and restore hooks on unload.
- Refresh hooks when Spotify replaces its API objects.
- Add Marketplace metadata, preview artwork, English/Turkish documentation, an MIT license, and a reproducible ZIP packager.

## 1.0.2 — 2026-11-06

- Fix the stale Player reference captured during extension startup.
- Do not treat a stale isBuffering flag as a reason to bypass a fade.
- Verify the 2-second volume ramp inside Spotify on macOS.

## 1.0.0 — 2026-11-06

- Initial Next-button fade-out, volume recovery, and profile-menu toggle.
