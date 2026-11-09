#!/usr/bin/env python3
"""Install/remove the user's local companion; no network or elevated service."""
import os
import json
import re
import time
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SUPPORT = Path.home() / "Library/Application Support/Smooth Next"
LABEL = "local.smooth-next.knob"
PLIST = Path.home() / "Library/LaunchAgents" / (LABEL + ".plist")
DOMAIN = f"gui/{os.getuid()}"

def run(*args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)

def bootout():
    # A missing previous service is normal on the first installation.
    previous = run("launchctl", "print", f"{DOMAIN}/{LABEL}", check=False)
    if previous.returncode == 0:
        match = re.search(r"^\s*pid = (\d+)\s*$", previous.stdout, re.M)
        pid = int(match.group(1)) if match else None
        run("launchctl", "bootout", f"{DOMAIN}/{LABEL}")
        # bootout can return before SIGTERM cleanup and job removal complete.
        # Starting immediately can fail with bootstrap error 5.
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            process_alive = False
            if pid:
                try:
                    os.kill(pid, 0)
                    process_alive = True
                except ProcessLookupError:
                    pass
            service_exists = run("launchctl", "print", f"{DOMAIN}/{LABEL}", check=False).returncode == 0
            if not process_alive and not service_exists:
                return
            time.sleep(0.1)
        raise RuntimeError("Previous companion is still stopping; retry the installation shortly.")

actions = ("install", "uninstall", "enable-gmmk3", "disable-gmmk3")
if len(sys.argv) < 2 or sys.argv[1] not in actions or sys.argv[2:] not in ([], ["--gmmk3"]):
    raise SystemExit("Usage: python3 macos/manage.py install [--gmmk3]|uninstall|enable-gmmk3|disable-gmmk3")
action = sys.argv[1]
if sys.argv[2:] and action != "install":
    raise SystemExit("--gmmk3 is only valid with install")

if action in ("enable-gmmk3", "disable-gmmk3") and not PLIST.exists():
    raise SystemExit("Install the companion first: bash macos/install.sh --gmmk3")

if action in ("enable-gmmk3", "disable-gmmk3") or "--gmmk3" in sys.argv:
    SUPPORT.mkdir(parents=True, exist_ok=True)
    settings_path = SUPPORT / "device-profiles.json"
    settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
    settings["gmmk3_media_keys"] = action != "disable-gmmk3"
    temporary = SUPPORT / "device-profiles.json.tmp"
    temporary.write_text(json.dumps(settings, indent=2) + "\n")
    temporary.replace(settings_path)

bootout()
if action in ("enable-gmmk3", "disable-gmmk3"):
    run("launchctl", "bootstrap", DOMAIN, str(PLIST))
    print("GMMK3 Fn+F5/F6 media mapping " + ("enabled" if action == "enable-gmmk3" else "disabled"))
elif action == "uninstall":
    # SIGTERM restores the device mapping before the helper exits.
    PLIST.unlink(missing_ok=True)
    print("Knob helper removed from login. Existing Spicetify fade extension is retained.")
else:
    SUPPORT.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    executable = SUPPORT / "smooth-next-knob"
    shutil.copy2(ROOT / "build/smooth-next-knob", executable)
    executable.chmod(0o755)
    config = {
        "Label": LABEL,
        "ProgramArguments": [str(executable)],
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 10,
        "ProcessType": "Interactive",
        "LimitLoadToSessionType": "Aqua",
        "StandardOutPath": str(SUPPORT / "knob.log"),
        "StandardErrorPath": str(SUPPORT / "knob-error.log"),
    }
    PLIST.write_bytes(plistlib.dumps(config))
    run("launchctl", "bootstrap", DOMAIN, str(PLIST))
    print(f"Installed: {executable}")
    print("The helper starts at login and only remaps Next while Spotify is connected.")
