# macOS companion: SDCX knob and GMMK3 media keys

The companion forwards the **Next track** knob action from the SDINNOVATION SIDE-KEYBOARD to Smooth Next. Even with Spotify in the background, the current song fades out over two seconds, then the next track starts at the original volume. There is no fade-in.

## Install

Extract the ZIP, open a terminal in its root folder, and run:

```sh
bash macos/install.sh
```

Requires macOS 13 or later, Spicetify, Python 3, and Spotify. The [GitHub release ZIP](https://github.com/enginhu/spicetify-smooth-next/releases/latest) includes an Apple Silicon companion. When installing from source or on a different architecture, the installer rebuilds it with the local Swift compiler, which requires Xcode Command Line Tools. Physical device checks were performed on the development Mac; older macOS releases have not been tested separately.

Installation enables `smooth-next.js` and `smooth-next-knob.js`. The companion runs under your user account and starts automatically at login. Turning off Smooth Next in Spotify's profile menu returns the SDCX knob to normal, immediate track skipping.

## Optional GMMK3 Fn+F5 / Fn+F6 profile

For the GMMK3 (100%) in Mac mode, explicitly enable the per-user profile with:

```sh
bash macos/install.sh --gmmk3
```

On USB model `342d:e3d1`, the profile maps the Voice Command signal from **Fn+F5** to **Previous track**, and the Do Not Disturb signal from **Fn+F6** to **Next track**. Next uses the same two-second fade-out when Spotify is connected and Smooth Next is enabled. Without a connection, or with Smooth Next disabled, both combinations remain native media keys. Plain F5/F6 and other keyboards are unaffected.

The preference is stored in `~/Library/Application Support/Smooth Next/device-profiles.json` and reapplied at login and after USB reconnection. SDCX support remains active. Stopping or removing the companion restores the keyboard's previous mappings.

To toggle only the GMMK3 profile after installation:

```sh
python3 macos/manage.py disable-gmmk3
python3 macos/manage.py enable-gmmk3
```

## How it works

- The verified SDCX device is USB `0816:2474`, manufacturer **SDINNOVATION**, product **SIDE-KEYBOARD**. The GMMK3 profile above is enabled separately and applies only to its listed USB ID.
- Only the SDCX device's **Consumer Scan Next Track** command is temporarily mapped to **F20** in macOS. The companion reserves F20 as a global hotkey. A physical F20 key also triggers the same action while that hotkey is registered. If the hotkey cannot be reserved, the companion does not apply the fade mapping.
- Commands reach the Spotify extension through `127.0.0.1:17643`. The port is accessible only from this computer, and the server validates the Spotify origin and protocol. No song metadata or typed text is transmitted.
- The SDCX volume knob, previous-track direction, and other key mappings are preserved. The companion does not write to device memory or firmware.
- Closing Spotify or disabling the extension restores the SDCX mapping and switches an enabled GMMK3 profile to native media keys. A normal companion shutdown restores both devices' previous mappings. WebSocket protocol ping/pong runs every five seconds instead of relying on JavaScript timers. After 20 seconds without a response, the connection closes and native behavior returns. Reconnecting the extension enables fade routing again.
- A reconnected keyboard is normally detected within about one second. Each scan uses a fresh HID client rather than stale service objects from a disconnected device. Mappings reset by the system to their saved baseline are reapplied. Existing mappings are preserved, and a different mapping subsequently applied by another tool is not overwritten.
- No Accessibility, Input Monitoring, administrator, or Spotify automation permission is requested. The companion does not record keystrokes; it receives only the reserved F20 hotkey.

## Installed files

- `~/Library/Application Support/Smooth Next/smooth-next-knob`: companion executable.
- In the same folder, `keymap-backup.plist` stores mapping recovery data; `device-profiles.json` stores optional device preferences; `knob.log` and `knob-error.log` contain operational logs.
- `~/Library/LaunchAgents/local.smooth-next.knob.plist`: starts the companion at login.
- Two JavaScript files in the Spicetify `Extensions` folder.

## Remove the companion

Run from the repository or extracted ZIP root:

```sh
bash macos/uninstall.sh
```

This stops the companion, restores previous mappings, and removes automatic startup and the bridge extension. Standard Smooth Next button and keyboard-shortcut support remains installed. The companion executable, preferences, and logs remain on disk for troubleshooting but are no longer active.

## Verification

On November 6, 2026, with Spotify 1.3.9.2039, Spicetify 2.46.4, and SDCX `0816:2474`, the user turned the physical knob with Spotify in the background and confirmed the two-second fade. The reported player volume reached zero at 2002 ms; by 2080 ms, the next track was playing at the original volume. Stopping the companion restored the previous mappings on both HID services. These timings describe player-state telemetry, not an audio waveform measurement.

Version 1.2.1 fixes reconnection and background timeout issues. On November 9, 2026, the keyboard was physically unplugged and reconnected while Spotify was minimized. The same running companion automatically mapped the new device services without losing its Spotify connection. The user confirmed that the knob still produced the two-second fade-out.

On November 9, 2026, the user also verified both physical GMMK3 Fn+F5 and Fn+F6 combinations. The persistent profile was reapplied after restarting the companion, and both native fallback and fade routing were observed on the device's HID services.

Run `bash macos/test.sh` for 18 native regression checks covering protocol liveness without JavaScript heartbeats, dead connections, mapping resets and conflicts, GMMK3 opt-in and native fallback, unchanged plain function keys, and SDCX compatibility.

The Swift source is in this directory. References: Apple's [per-device key mapping API](https://developer.apple.com/library/archive/technotes/tn2450/) and [WebSocket server handshake API](https://developer.apple.com/documentation/network/nwprotocolwebsocket/options/setclientrequesthandler(_:handler:)).
